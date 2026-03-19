import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';
import { ScoredDependency, RiskLevel } from './types';
import { topSignal } from './scorer';

export async function createCheckRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  headSha: string,
  scoredDeps: ScoredDependency[],
  failOn: RiskLevel | ''
): Promise<number | null> {
  try {
    const { data: checkRun } = await octokit.rest.checks.create({
      owner,
      repo,
      name: 'ghostdeps',
      head_sha: headSha,
      status: 'in_progress',
      started_at: new Date().toISOString()
    });

    return checkRun.id;
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 403) {
      core.warning('checks:write permission not available - skipping check run creation');
      return null;
    }
    throw error;
  }
}

export async function updateCheckRunWithAnnotations(
  octokit: Octokit,
  owner: string,
  repo: string,
  checkRunId: number,
  scoredDeps: ScoredDependency[],
  failOn: RiskLevel | ''
): Promise<void> {
  try {
    // Create annotations for MEDIUM and HIGH findings
    const annotations = scoredDeps
      .filter(dep => dep.riskLevel === 'medium' || dep.riskLevel === 'high')
      .map(dep => ({
        path: dep.file,
        start_line: dep.line,
        end_line: dep.line,
        annotation_level: (dep.riskLevel === 'high' ? 'warning' : 'notice') as 'warning' | 'notice',
        title: `👻 ghostdeps: ${dep.riskLevel.toUpperCase()} risk dependency`,
        message: topSignal(dep.signals),
        raw_details: JSON.stringify(dep.signals, null, 2)
      }));

    // Determine conclusion
    let conclusion: 'success' | 'failure' | 'neutral' = 'neutral';
    const shouldFail = failOn && shouldFailOnLevel(scoredDeps, failOn);
    if (shouldFail) {
      conclusion = 'failure';
    }

    // Summary
    const highCount = scoredDeps.filter(d => d.riskLevel === 'high').length;
    const mediumCount = scoredDeps.filter(d => d.riskLevel === 'medium').length;
    const lowCount = scoredDeps.filter(d => d.riskLevel === 'low').length;

    let summary = `Scanned ${scoredDeps.length} new dependencies\n\n`;
    if (highCount > 0) summary += `⚠️  ${highCount} HIGH risk\n`;
    if (mediumCount > 0) summary += `⚠️  ${mediumCount} MEDIUM risk\n`;
    if (lowCount > 0) summary += `✓ ${lowCount} LOW risk\n`;

    // Update check run - GitHub API limits to 50 annotations per request
    const chunks = [];
    for (let i = 0; i < annotations.length; i += 50) {
      chunks.push(annotations.slice(i, i + 50));
    }

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;

      await octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: checkRunId,
        status: isLast ? 'completed' : 'in_progress',
        conclusion: isLast ? conclusion : undefined,
        completed_at: isLast ? new Date().toISOString() : undefined,
        output: {
          title: conclusion === 'failure' ? '👻 ghostdeps: Suspicious dependencies detected' : '👻 ghostdeps',
          summary,
          annotations: chunks[i]
        }
      });
    }

    // If no annotations, still complete the check
    if (annotations.length === 0) {
      await octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: checkRunId,
        status: 'completed',
        conclusion,
        completed_at: new Date().toISOString(),
        output: {
          title: '👻 ghostdeps',
          summary
        }
      });
    }
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 403) {
      core.warning('checks:write permission not available - skipping annotations');
      return;
    }
    throw error;
  }
}

function shouldFailOnLevel(scoredDeps: ScoredDependency[], failOn: RiskLevel): boolean {
  const riskLevels: RiskLevel[] = ['low', 'medium', 'high'];
  const failOnIndex = riskLevels.indexOf(failOn);

  for (const dep of scoredDeps) {
    const depIndex = riskLevels.indexOf(dep.riskLevel);
    if (depIndex >= failOnIndex) {
      return true;
    }
  }

  return false;
}
