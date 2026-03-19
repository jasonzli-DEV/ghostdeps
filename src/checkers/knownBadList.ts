import { Ecosystem, RiskSignal } from '../types';
import * as fs from 'fs';
import * as path from 'path';

let knownHallucinations: Record<string, string[]> = {};

export function loadKnownHallucinations(): void {
  try {
    const dataPath = path.join(__dirname, '..', '..', 'data', 'known-hallucinations.json');
    const content = fs.readFileSync(dataPath, 'utf-8');
    knownHallucinations = JSON.parse(content);
  } catch (error) {
    // If we can't load the file, use empty object
    knownHallucinations = {};
  }
}

function normalizePackageName(name: string): string[] {
  const normalized = name.toLowerCase();
  const variants: string[] = [normalized];

  // Generate separator variants (- vs _ vs .)
  if (normalized.includes('-')) {
    variants.push(normalized.replace(/-/g, '_'));
    variants.push(normalized.replace(/-/g, '.'));
  }
  if (normalized.includes('_')) {
    variants.push(normalized.replace(/_/g, '-'));
    variants.push(normalized.replace(/_/g, '.'));
  }
  if (normalized.includes('.')) {
    variants.push(normalized.replace(/\./g, '-'));
    variants.push(normalized.replace(/\./g, '_'));
  }

  return variants;
}

export function checkKnownBadList(
  packageName: string,
  ecosystem: Ecosystem
): RiskSignal | null {
  const knownList = knownHallucinations[ecosystem] || [];
  if (knownList.length === 0) return null;

  const variants = normalizePackageName(packageName);

  for (const variant of variants) {
    for (const knownBad of knownList) {
      const knownVariants = normalizePackageName(knownBad);

      if (knownVariants.includes(variant)) {
        return {
          signal: 'knownBadList',
          severity: 'high',
          detail: `Known AI hallucination: '${knownBad}'`
        };
      }
    }
  }

  return null;
}
