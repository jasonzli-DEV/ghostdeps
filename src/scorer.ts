import { RiskSignal, RiskLevel } from './types';

export function scoreRisk(signals: RiskSignal[]): RiskLevel {
  if (signals.length === 0) return 'low';

  // Check for knownBadList - always HIGH
  const hasKnownBad = signals.some(s => s.signal === 'knownBadList');
  if (hasKnownBad) return 'high';

  // Check for any HIGH signal
  const hasHigh = signals.some(s => s.severity === 'high');
  if (hasHigh) return 'high';

  // Count MEDIUM signals
  const mediumCount = signals.filter(s => s.severity === 'medium').length;
  if (mediumCount >= 2) return 'high';
  if (mediumCount >= 1) return 'medium';

  return 'low';
}

export function topSignal(signals: RiskSignal[]): string {
  if (signals.length === 0) return 'No specific risk signals';

  // Prioritize knownBadList
  const knownBad = signals.find(s => s.signal === 'knownBadList');
  if (knownBad) return knownBad.detail;

  // Then HIGH severity
  const high = signals.find(s => s.severity === 'high');
  if (high) return high.detail;

  // Then MEDIUM
  const medium = signals.find(s => s.severity === 'medium');
  if (medium) return medium.detail;

  // Otherwise return first signal
  return signals[0].detail;
}
