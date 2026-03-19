import { getOctokit } from '@actions/github';
import { DependencyHit } from './types';
type Octokit = ReturnType<typeof getOctokit>;
export declare function fetchPRDiff(octokit: Octokit, owner: string, repo: string, pullNumber: number): Promise<DependencyHit[]>;
export {};
