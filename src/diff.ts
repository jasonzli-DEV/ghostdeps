import { getOctokit } from '@actions/github';
import { DependencyHit } from './types';
import { detectEcosystem, parseDependencyFile } from './parsers';

type Octokit = ReturnType<typeof getOctokit>;

interface FileDiff {
  filename: string;
  patch?: string;
}

interface ParseOptions {
  file: FileDiff;
  allHits: DependencyHit[];
}

function parseFileDiff({ file, allHits }: ParseOptions): void {
  // Skip binary files
  if (!file.patch) return;

  const ecosystem = detectEcosystem(file.filename);
  if (!ecosystem) return;

  // Parse dependencies from the diff
  const parsedDeps = parseDependencyFile(file.patch, file.filename, ecosystem);

  // Convert to DependencyHit
  for (const dep of parsedDeps) {
    allHits.push({
      packageName: dep.packageName,
      version: dep.version,
      ecosystem,
      file: file.filename,
      line: dep.line
    });
  }
}

export async function fetchPRDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<DependencyHit[]> {
  const allHits: DependencyHit[] = [];

  try {
    // Fetch PR files
    const iterator = octokit.paginate.iterator(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100
    });

    for await (const response of iterator) {
      const files = response.data as FileDiff[];

      for (const file of files) {
        parseFileDiff({ file, allHits });
      }
    }

    return allHits;
  } catch (error) {
    // Log error but don't throw - return empty array
    console.error('Error fetching PR diff:', error);
    return [];
  }
}

export async function fetchCommitDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string
): Promise<DependencyHit[]> {
  const allHits: DependencyHit[] = [];

  try {
    const comparison = await octokit.rest.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${baseSha}...${headSha}`
    });

    const files = (comparison.data.files || []) as FileDiff[];
    for (const file of files) {
      parseFileDiff({ file, allHits });
    }

    return allHits;
  } catch (error) {
    // Log error but don't throw - return empty array
    console.error('Error fetching commit diff:', error);
    return [];
  }
}
