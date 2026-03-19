import { getOctokit } from '@actions/github';
import { ScoredDependency } from './types';
type Octokit = ReturnType<typeof getOctokit>;
export declare function upsertPRComment(octokit: Octokit, owner: string, repo: string, pullNumber: number, scoredDeps: ScoredDependency[], sha: string, postComment: boolean): Promise<void>;
export {};
