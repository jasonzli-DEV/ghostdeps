import * as core from '@actions/core';
import * as github from '@actions/github';
import { ActionInputs, Ecosystem, ScoredDependency, RiskLevel, DependencyHit } from './types';
import { fetchPRDiff } from './diff';
import { checkRegistryAge } from './checkers/registryAge';
import { checkDownloadVelocity } from './checkers/downloadVelocity';
import { checkCrossEcosystem } from './checkers/crossEcosystem';
import { checkTyposquat } from './checkers/typosquat';
import { checkKnownBadList, loadKnownHallucinations } from './checkers/knownBadList';
import { scoreRisk } from './scorer';
import { createCheckRun, updateCheckRunWithAnnotations } from './annotator';
import { upsertPRComment } from './reporter';

function parseInputs(): ActionInputs {
  const failOnInput = core.getInput('fail-on').trim();
  const failOn: RiskLevel | '' = failOnInput === 'high' || failOnInput === 'medium' || failOnInput === 'low'
    ? failOnInput
    : '';

  const postCommentInput = core.getInput('post-comment').trim().toLowerCase();
  const postComment = postCommentInput !== 'false';

  const ecosystemsInput = core.getInput('ecosystems').trim().toLowerCase();
  let ecosystems: Ecosystem[] | 'all' = 'all';
  if (ecosystemsInput !== 'all' && ecosystemsInput !== '') {
    const parsed = ecosystemsInput.split(',').map(e => e.trim()) as Ecosystem[];
    ecosystems = parsed;
  }

  const token = core.getInput('token', { required: true });

  return {
    failOn,
    postComment,
    ecosystems,
    token
  };
}

async function runCheckers(dep: DependencyHit): Promise<ScoredDependency> {
  // Run all checkers in parallel
  const results = await Promise.allSettled([
    checkRegistryAge(dep.packageName, dep.ecosystem),
    checkDownloadVelocity(dep.packageName, dep.ecosystem),
    checkCrossEcosystem(dep.packageName, dep.ecosystem),
    Promise.resolve(checkTyposquat(dep.packageName, dep.ecosystem)),
    Promise.resolve(checkKnownBadList(dep.packageName, dep.ecosystem))
  ]);

  const signals = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<any>).value);

  const riskLevel = scoreRisk(signals);

  return {
    ...dep,
    riskLevel,
    signals
  };
}

function filterByEcosystems(deps: DependencyHit[], ecosystems: Ecosystem[] | 'all'): DependencyHit[] {
  if (ecosystems === 'all') return deps;
  return deps.filter(dep => ecosystems.includes(dep.ecosystem));
}

async function run(): Promise<void> {
  let checkRunId: number | null = null;

  try {
    // Load known hallucinations
    loadKnownHallucinations();

    // Parse inputs
    const inputs = parseInputs();

    // Get PR context
    const context = github.context;
    if (!context.payload.pull_request) {
      core.info('Not a pull request event - skipping');
      return;
    }

    const pullRequest = context.payload.pull_request;
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const pullNumber = pullRequest.number;
    const headSha = pullRequest.head.sha;

    // Initialize Octokit with GHES support
    const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
    const octokit = github.getOctokit(inputs.token, {
      baseUrl: apiUrl
    });

    core.info(`Scanning PR #${pullNumber}...`);

    // Fetch diff and parse dependencies
    const allDeps = await fetchPRDiff(octokit, owner, repo, pullNumber);
    core.info(`Found ${allDeps.length} total dependencies`);

    // Filter by ecosystems
    const filteredDeps = filterByEcosystems(allDeps, inputs.ecosystems);
    core.info(`Filtered to ${filteredDeps.length} dependencies for requested ecosystems`);

    // If zero deps, complete neutral and exit
    if (filteredDeps.length === 0) {
      core.info('No new dependencies to scan - exiting');
      return;
    }

    // Create check run
    checkRunId = await createCheckRun(octokit, owner, repo, headSha, [], inputs.failOn);
    if (checkRunId) {
      core.info(`Created check run #${checkRunId}`);
    }

    // Run checkers for each dependency
    core.info('Running security checks...');
    const scoredDeps: ScoredDependency[] = [];

    for (const dep of filteredDeps) {
      const scored = await runCheckers(dep);
      scoredDeps.push(scored);
      core.info(`${dep.packageName}: ${scored.riskLevel} (${scored.signals.length} signals)`);
    }

    // Update check run with annotations
    if (checkRunId) {
      await updateCheckRunWithAnnotations(octokit, owner, repo, checkRunId, scoredDeps, inputs.failOn);
      core.info('Updated check run with annotations');
    }

    // Upsert PR comment
    await upsertPRComment(octokit, owner, repo, pullNumber, scoredDeps, headSha, inputs.postComment);
    core.info('Updated PR comment');

    // Determine if we should fail
    const highCount = scoredDeps.filter(d => d.riskLevel === 'high').length;
    const mediumCount = scoredDeps.filter(d => d.riskLevel === 'medium').length;
    const lowCount = scoredDeps.filter(d => d.riskLevel === 'low').length;

    core.info(`Results: ${highCount} HIGH, ${mediumCount} MEDIUM, ${lowCount} LOW`);

    // Set failure if fail-on threshold met
    if (inputs.failOn) {
      const shouldFail = scoredDeps.some(dep => {
        if (inputs.failOn === 'low') return true;
        if (inputs.failOn === 'medium') return dep.riskLevel === 'medium' || dep.riskLevel === 'high';
        if (inputs.failOn === 'high') return dep.riskLevel === 'high';
        return false;
      });

      if (shouldFail) {
        core.setFailed(`Suspicious dependencies detected (fail-on: ${inputs.failOn})`);
      }
    }
  } catch (error) {
    // On any error, complete check run as neutral if it exists
    if (checkRunId) {
      try {
        const context = github.context;
        const inputs = parseInputs();
        const octokit = github.getOctokit(inputs.token);

        await octokit.rest.checks.update({
          owner: context.repo.owner,
          repo: context.repo.repo,
          check_run_id: checkRunId,
          status: 'completed',
          conclusion: 'neutral',
          completed_at: new Date().toISOString(),
          output: {
            title: '👻 ghostdeps: Error occurred',
            summary: 'An error occurred while scanning dependencies. Check logs for details.'
          }
        });
      } catch (updateError) {
        // Ignore errors updating check run
      }
    }

    // Log error but exit 0 - never crash CI pipeline
    core.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      core.debug(error.stack);
    }
  }
}

run();
