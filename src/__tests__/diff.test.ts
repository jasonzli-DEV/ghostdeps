import { fetchPRDiff, fetchCommitDiff } from '../diff';

describe('diff fetchers', () => {
  const owner = 'octo';
  const repo = 'ghostdeps';

  it('fetchPRDiff parses dependencies from PR file patches', async () => {
    const octokit = {
      paginate: {
        iterator: jest.fn(async function* () {
          yield {
            data: [
              {
                filename: 'package.json',
                patch: '+  "dependencies": {\n+    "lodash": "^4.17.21"\n+  }'
              }
            ]
          };
        })
      },
      rest: {
        pulls: {
          listFiles: jest.fn()
        }
      }
    } as any;

    const result = await fetchPRDiff(octokit, owner, repo, 42);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      packageName: 'lodash',
      version: '^4.17.21',
      ecosystem: 'npm',
      file: 'package.json'
    });
  });

  it('fetchCommitDiff parses dependencies from compared commits', async () => {
    const compareCommitsWithBasehead = jest.fn().mockResolvedValue({
      data: {
        files: [
          {
            filename: 'requirements.txt',
            patch: '+requests==2.31.0'
          }
        ]
      }
    });

    const octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead
        }
      }
    } as any;

    const result = await fetchCommitDiff(octokit, owner, repo, 'baseSha', 'headSha');
    expect(compareCommitsWithBasehead).toHaveBeenCalledWith({
      owner,
      repo,
      basehead: 'baseSha...headSha'
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      packageName: 'requests',
      version: '2.31.0',
      ecosystem: 'python',
      file: 'requirements.txt'
    });
  });
});
