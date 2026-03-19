import { checkTyposquat } from '../typosquat';

describe('checkTyposquat', () => {
  it('should detect distance 1 typosquat as HIGH', () => {
    const result = checkTyposquat('expres', 'npm'); // "express" -> "expres" (delete 's')
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('high');
    expect(result?.detail).toContain('express');
  });

  it('should detect distance 2 typosquat as MEDIUM', () => {
    const result = checkTyposquat('reqeusts', 'python'); // "requests" -> "reqeusts"
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('medium');
    expect(result?.detail).toContain('requests');
  });

  it('should not flag exact match', () => {
    const result = checkTyposquat('react', 'npm');
    expect(result).toBeNull();
  });

  it('should skip names < 3 characters', () => {
    const result = checkTyposquat('ab', 'npm');
    expect(result).toBeNull();
  });

  it('should skip scoped npm packages', () => {
    const result = checkTyposquat('@babel/core', 'npm');
    expect(result).toBeNull();
  });

  it('should not flag packages with distance > 2', () => {
    const result = checkTyposquat('completely-different', 'npm');
    expect(result).toBeNull();
  });
});
