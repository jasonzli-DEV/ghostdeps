import { getOctokit } from '@actions/github';
import { ScoredDependency, RiskLevel } from './types';
type Octokit = ReturnType<typeof getOctokit>;
export declare function createCheckRun(octokit: Octokit, owner: string, repo: string, headSha: string, _scoredDeps: ScoredDependency[], _failOn: RiskLevel | ''): Promise<number | null>;
export declare function updateCheckRunWithAnnotations(octokit: Octokit, owner: string, repo: string, checkRunId: number, scoredDeps: ScoredDependency[], failOn: RiskLevel | ''): Promise<void>;
export {};
