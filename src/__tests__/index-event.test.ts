jest.mock('@actions/core', () => ({
  getInput: jest.fn((name: string) => {
    if (name === 'token') return 'test-token';
    if (name === 'post-comment') return 'false';
    return '';
  }),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setFailed: jest.fn()
}));

const fetchPRDiffMock = jest.fn();
const fetchCommitDiffMock = jest.fn();
jest.mock('../diff', () => ({
  fetchPRDiff: (...args: any[]) => fetchPRDiffMock(...args),
  fetchCommitDiff: (...args: any[]) => fetchCommitDiffMock(...args)
}));

jest.mock('../checkers/knownBadList', () => ({
  loadKnownHallucinations: jest.fn(),
  checkKnownBadList: jest.fn().mockReturnValue(null)
}));
jest.mock('../checkers/registryAge', () => ({
  checkRegistryAge: jest.fn().mockResolvedValue(null)
}));
jest.mock('../checkers/downloadVelocity', () => ({
  checkDownloadVelocity: jest.fn().mockResolvedValue(null)
}));
jest.mock('../checkers/crossEcosystem', () => ({
  checkCrossEcosystem: jest.fn().mockResolvedValue(null)
}));
jest.mock('../checkers/typosquat', () => ({
  checkTyposquat: jest.fn().mockReturnValue(null)
}));
jest.mock('../annotator', () => ({
  createCheckRun: jest.fn().mockResolvedValue(1),
  updateCheckRunWithAnnotations: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../reporter', () => ({
  upsertPRComment: jest.fn().mockResolvedValue(undefined)
}));

describe('index event routing', () => {
  beforeEach(() => {
    jest.resetModules();
    fetchPRDiffMock.mockReset().mockResolvedValue([]);
    fetchCommitDiffMock.mockReset().mockResolvedValue([]);
  });

  it('uses commit diff flow on push events', async () => {
    jest.doMock('@actions/github', () => ({
      context: {
        eventName: 'push',
        repo: { owner: 'octo', repo: 'ghostdeps' },
        sha: 'head-sha',
        payload: { before: 'base-sha' }
      },
      getOctokit: jest.fn(() => ({ rest: { repos: {} } }))
    }));

    await import('../index');
    await new Promise(resolve => setImmediate(resolve));

    expect(fetchCommitDiffMock).toHaveBeenCalledWith(
      expect.anything(),
      'octo',
      'ghostdeps',
      'base-sha',
      'head-sha'
    );
    expect(fetchPRDiffMock).not.toHaveBeenCalled();
  });

  it('uses PR diff flow on pull_request events', async () => {
    jest.doMock('@actions/github', () => ({
      context: {
        eventName: 'pull_request',
        repo: { owner: 'octo', repo: 'ghostdeps' },
        payload: {
          pull_request: {
            number: 7,
            head: { sha: 'head-pr' },
            base: { sha: 'base-pr' }
          }
        }
      },
      getOctokit: jest.fn(() => ({ rest: { pulls: {}, repos: {} }, paginate: {} }))
    }));

    await import('../index');
    await new Promise(resolve => setImmediate(resolve));

    expect(fetchPRDiffMock).toHaveBeenCalledWith(
      expect.anything(),
      'octo',
      'ghostdeps',
      7
    );
    expect(fetchCommitDiffMock).not.toHaveBeenCalled();
  });
});
