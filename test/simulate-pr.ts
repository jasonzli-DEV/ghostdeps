import * as fs from 'fs';
import * as path from 'path';
import { parseNpm } from '../src/parsers/npm';
import { parsePython } from '../src/parsers/python';
import { parseGo } from '../src/parsers/go';
import { parseRust } from '../src/parsers/rust';
import { parseRuby } from '../src/parsers/ruby';
import { parsePhp } from '../src/parsers/php';
import { parseDotnet } from '../src/parsers/dotnet';
import { checkKnownBadList } from '../src/checkers/knownBadList';
import { checkTyposquat } from '../src/checkers/typosquat';

interface ParsedDependency {
  packageName: string;
  version: string;
  line: number;
}

type Ecosystem = 'npm' | 'python' | 'go' | 'rust' | 'ruby' | 'php' | 'dotnet';

interface ExtractedPackage extends ParsedDependency {
  file: string;
  ecosystem: Ecosystem;
}

function detectEcosystem(filename: string): Ecosystem | null {
  const lower = filename.toLowerCase();

  if (lower.includes('package.json')) return 'npm';
  if (lower.includes('requirements') && lower.endsWith('.txt')) return 'python';
  if (lower.includes('pyproject.toml')) return 'python';
  if (lower.includes('pipfile')) return 'python';
  if (lower.includes('go.mod')) return 'go';
  if (lower.includes('cargo.toml')) return 'rust';
  if (lower.includes('gemfile')) return 'ruby';
  if (lower.includes('composer.json')) return 'php';
  if (lower.endsWith('.csproj') || lower.endsWith('.vbproj') || lower.endsWith('.fsproj')) return 'dotnet';
  if (lower.includes('packages.config')) return 'dotnet';

  return null;
}

function parseFile(content: string, filename: string, ecosystem: Ecosystem): ParsedDependency[] {
  // Simulate PR diff format by prefixing lines with '+'
  const diffContent = content.split('\n').map(line => `+${line}`).join('\n');

  switch (ecosystem) {
    case 'npm':
      return parseNpm(diffContent);
    case 'python':
      return parsePython(diffContent, filename);
    case 'go':
      return parseGo(diffContent);
    case 'rust':
      return parseRust(diffContent);
    case 'ruby':
      return parseRuby(diffContent);
    case 'php':
      return parsePhp(diffContent);
    case 'dotnet':
      return parseDotnet(diffContent, filename);
    default:
      return [];
  }
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function main() {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const allFiles = getAllFiles(fixturesDir);

  const extractedPackages: ExtractedPackage[] = [];

  console.log('='.repeat(80));
  console.log('SIMULATING PR: Scanning all fixtures');
  console.log('='.repeat(80));
  console.log();

  for (const filePath of allFiles) {
    const filename = path.basename(filePath);
    const ecosystem = detectEcosystem(filename);

    if (!ecosystem) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const dependencies = parseFile(content, filename, ecosystem);

    for (const dep of dependencies) {
      const relativePath = path.relative(fixturesDir, filePath);
      extractedPackages.push({
        ...dep,
        file: relativePath,
        ecosystem
      });
    }
  }

  // Print extraction results
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ File                              │ Package                │ Ver     │ Line │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');

  for (const pkg of extractedPackages) {
    const file = pkg.file.padEnd(35).substring(0, 35);
    const name = pkg.packageName.padEnd(22).substring(0, 22);
    const ver = (pkg.version || 'null').padEnd(7).substring(0, 7);
    const line = pkg.line.toString().padStart(4);
    console.log(`│ ${file} │ ${name} │ ${ver} │ ${line} │`);
  }

  console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  console.log();

  // Run checkers
  console.log('='.repeat(80));
  console.log('RISK ASSESSMENT');
  console.log('='.repeat(80));
  console.log();

  const riskCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };

  for (const pkg of extractedPackages) {
    const signals: Array<{ severity: 'low' | 'medium' | 'high', detail: string }> = [];

    // Check known bad list
    const knownBadSignal = checkKnownBadList(pkg.packageName, pkg.ecosystem);
    if (knownBadSignal) {
      signals.push(knownBadSignal);
    }

    // Check typosquat
    const typosquatSignal = checkTyposquat(pkg.packageName, pkg.ecosystem);
    if (typosquatSignal) {
      signals.push(typosquatSignal);
    }

    // Check for git/VCS markers
    if (pkg.version === 'git' || pkg.version === 'git+' || pkg.version.startsWith('git+')) {
      signals.push({ severity: 'medium', detail: 'Git dependency' });
    }

    // Determine overall risk
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    if (signals.some(s => s.severity === 'high')) {
      riskLevel = 'HIGH';
    } else if (signals.some(s => s.severity === 'medium')) {
      riskLevel = 'MEDIUM';
    }

    riskCounts[riskLevel]++;

    // Print if not LOW
    if (riskLevel !== 'LOW') {
      console.log(`${pkg.packageName.padEnd(30)} → ${riskLevel.padEnd(6)} ${signals.map(s => s.detail).join(', ')}`);
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log(`${extractedPackages.length} packages extracted across ${new Set(extractedPackages.map(p => p.file)).size} files`);
  console.log(`${riskCounts.HIGH} HIGH, ${riskCounts.MEDIUM} MEDIUM, ${riskCounts.LOW} LOW`);
  console.log();
}

main();
