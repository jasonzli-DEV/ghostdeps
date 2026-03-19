import { RiskSignal, RiskLevel } from './types';
export declare function scoreRisk(signals: RiskSignal[]): RiskLevel;
export declare function topSignal(signals: RiskSignal[]): string;
