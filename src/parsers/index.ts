import { Ecosystem } from '../types';
import { parseNpm } from './npm';
import { parsePython } from './python';
import { parseRuby } from './ruby';
import { parseGo } from './go';
import { parseRust } from './rust';
import { parsePhp } from './php';
import { parseDotnet } from './dotnet';

export interface ParsedDependency {
  packageName: string;
  version: string;
  line: number;
}

export function detectEcosystem(filename: string): Ecosystem | null {
  const lowerFilename = filename.toLowerCase();

  if (lowerFilename.endsWith('package.json')) {
    return 'npm';
  }

  if (lowerFilename.includes('requirements') && lowerFilename.endsWith('.txt') ||
      lowerFilename.includes('pyproject.toml') ||
      lowerFilename.includes('pipfile')) {
    return 'python';
  }

  if (lowerFilename.includes('gemfile')) {
    return 'ruby';
  }

  if (lowerFilename.endsWith('go.mod')) {
    return 'go';
  }

  if (lowerFilename.endsWith('cargo.toml')) {
    return 'rust';
  }

  if (lowerFilename.endsWith('composer.json')) {
    return 'php';
  }

  if (lowerFilename.endsWith('.csproj') ||
      lowerFilename.endsWith('.vbproj') ||
      lowerFilename.endsWith('.fsproj') ||
      lowerFilename.includes('packages.config')) {
    return 'dotnet';
  }

  return null;
}

export function parseDependencyFile(
  diffContent: string,
  filename: string,
  ecosystem: Ecosystem
): ParsedDependency[] {
  try {
    switch (ecosystem) {
      case 'npm':
        return parseNpm(diffContent);
      case 'python':
        return parsePython(diffContent, filename);
      case 'ruby':
        return parseRuby(diffContent);
      case 'go':
        return parseGo(diffContent);
      case 'rust':
        return parseRust(diffContent);
      case 'php':
        return parsePhp(diffContent);
      case 'dotnet':
        return parseDotnet(diffContent, filename);
      default:
        return [];
    }
  } catch (error) {
    return [];
  }
}
