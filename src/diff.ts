import { Octokit } from '@octokit/rest';
import { DependencyHit, Ecosystem } from './types';
import { detectEcosystem, parseDependencyFile } from './parsers';

interface FileDiff {
  filename: string;
  patch?: string;
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
        // Skip binary files
        if (!file.patch) continue;

        const ecosystem = detectEcosystem(file.filename);
        if (!ecosystem) continue;

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
    }

    return allHits;
  } catch (error) {
    // Log error but don't throw - return empty array
    console.error('Error fetching PR diff:', error);
    return [];
  }
}
