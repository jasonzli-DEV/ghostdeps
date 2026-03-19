import { scoreRisk, topSignal } from '../scorer';
import { RiskSignal } from '../types';

describe('scoreRisk', () => {
  it('should return low for empty signals', () => {
    expect(scoreRisk([])).toBe('low');
  });

  it('should return high for knownBadList signal', () => {
    const signals: RiskSignal[] = [
      { signal: 'knownBadList', severity: 'high', detail: 'Known hallucination' }
    ];
    expect(scoreRisk(signals)).toBe('high');
  });

  it('should return high for any HIGH severity signal', () => {
    const signals: RiskSignal[] = [
      { signal: 'registryAge', severity: 'high', detail: 'Very new package' }
    ];
    expect(scoreRisk(signals)).toBe('high');
  });

  it('should return high for 2+ MEDIUM signals', () => {
    const signals: RiskSignal[] = [
      { signal: 'registryAge', severity: 'medium', detail: 'Recently created' },
      { signal: 'downloadVelocity', severity: 'medium', detail: 'Low downloads' }
    ];
    expect(scoreRisk(signals)).toBe('high');
  });

  it('should return medium for 1 MEDIUM signal', () => {
    const signals: RiskSignal[] = [
      { signal: 'registryAge', severity: 'medium', detail: 'Recently created' }
    ];
    expect(scoreRisk(signals)).toBe('medium');
  });

  it('should return low for only LOW signals', () => {
    const signals: RiskSignal[] = [
      { signal: 'registryAge', severity: 'low', detail: 'Established package' }
    ];
    expect(scoreRisk(signals)).toBe('low');
  });
});

describe('topSignal', () => {
  it('should return default message for empty signals', () => {
    expect(topSignal([])).toBe('No specific risk signals');
  });

  it('should prioritize knownBadList', () => {
    const signals: RiskSignal[] = [
      { signal: 'registryAge', severity: 'high', detail: 'Very new' },
      { signal: 'knownBadList', severity: 'high', detail: 'Known hallucination' }
    ];
    expect(topSignal(signals)).toBe('Known hallucination');
  });

  it('should prioritize HIGH over MEDIUM', () => {
    const signals: RiskSignal[] = [
      { signal: 'registryAge', severity: 'medium', detail: 'Medium risk' },
      { signal: 'typosquat', severity: 'high', detail: 'Typosquat detected' }
    ];
    expect(topSignal(signals)).toBe('Typosquat detected');
  });
});
