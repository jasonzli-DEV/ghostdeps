import { checkKnownBadList, loadKnownHallucinations } from '../knownBadList';

// Load hallucinations before tests
beforeAll(() => {
  loadKnownHallucinations();
});

describe('checkKnownBadList', () => {
  it('should detect exact match', () => {
    const result = checkKnownBadList('react-codeshift', 'npm');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('high');
    expect(result?.signal).toBe('knownBadList');
  });

  it('should detect case-insensitive match', () => {
    const result = checkKnownBadList('React-Codeshift', 'npm');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('high');
  });

  it('should detect separator variants', () => {
    // If known list has "python-datutil", should also match "python_datutil"
    const result = checkKnownBadList('python_datutil', 'python');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('high');
  });

  it('should not flag legitimate packages', () => {
    const result = checkKnownBadList('express', 'npm');
    expect(result).toBeNull();
  });

  it('should not flag packages from wrong ecosystem', () => {
    const result = checkKnownBadList('react-codeshift', 'python');
    expect(result).toBeNull();
  });
});
