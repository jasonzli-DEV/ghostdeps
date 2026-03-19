export type Ecosystem = 'npm' | 'python' | 'ruby' | 'go' | 'rust' | 'php' | 'dotnet';

export interface DependencyHit {
  packageName: string;
  version: string;
  ecosystem: Ecosystem;
  file: string;
  line: number;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskSignal {
  signal: string;
  severity: RiskLevel;
  detail: string;
}

export interface ScoredDependency extends DependencyHit {
  riskLevel: RiskLevel;
  signals: RiskSignal[];
}

export interface ActionInputs {
  failOn: RiskLevel | '';
  postComment: boolean;
  ecosystems: Ecosystem[] | 'all';
  token: string;
}
