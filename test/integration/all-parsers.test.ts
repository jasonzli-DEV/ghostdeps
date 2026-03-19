import * as fs from 'fs';
import * as path from 'path';
import { parseNpm } from '../../src/parsers/npm';
import { parsePython } from '../../src/parsers/python';
import { parseGo } from '../../src/parsers/go';
import { parseRust } from '../../src/parsers/rust';
import { parseRuby } from '../../src/parsers/ruby';
import { parsePhp } from '../../src/parsers/php';
import { parseDotnet } from '../../src/parsers/dotnet';

describe('All Parsers Integration Tests', () => {
  const fixturesDir = path.join(__dirname, '..', 'fixtures');

  function readFixture(relativePath: string): string {
    return fs.readFileSync(path.join(fixturesDir, relativePath), 'utf-8');
  }

  function toDiff(content: string): string {
    return content.split('\n').map(line => `+${line}`).join('\n');
  }

  describe('NPM Parser', () => {
    it('should parse npm-real/package.json', () => {
      const content = readFixture('npm-real/package.json');
      const diff = toDiff(content);
      const results = parseNpm(diff);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.packageName === 'express')).toBe(true);
      expect(results.some(r => r.packageName === 'lodash')).toBe(true);

      // Should handle git URLs
      const gitDep = results.find(r => r.version === 'git+');
      expect(gitDep).toBeDefined();

      // Should skip workspace: and file: protocols
      expect(results.every(r => !r.version.startsWith('workspace:'))).toBe(true);
      expect(results.every(r => !r.version.startsWith('file:'))).toBe(true);
    });

    it('should handle malformed JSON gracefully', () => {
      const content = readFixture('edge-cases/malformed-package.json');
      const diff = toDiff(content);
      const results = parseNpm(diff);

      // Should not throw and extract what it can
      expect(results).toBeDefined();
    });
  });

  describe('Python Parser', () => {
    it('should parse python-real/requirements.txt', () => {
      const content = readFixture('python-real/requirements.txt');
      const diff = toDiff(content);
      const results = parsePython(diff, 'requirements.txt');

      expect(results.length).toBeGreaterThan(0);

      // Should handle git URLs
      expect(results.some(r => r.version === 'git+')).toBe(true);

      // Should handle packages without versions
      expect(results.some(r => r.version === 'latest')).toBe(true);
    });

    it('should handle edge cases in requirements-edge.txt', () => {
      const content = readFixture('edge-cases/requirements-edge.txt');
      const diff = toDiff(content);
      const results = parsePython(diff, 'requirements-edge.txt');

      expect(results.length).toBeGreaterThan(0);

      // Should handle packages with dots and underscores
      expect(results.some(r => r.packageName.includes('.'))).toBe(true);

      // Should handle UPPERCASE packages
      expect(results.some(r => r.packageName === 'UPPERCASE-PACKAGE')).toBe(true);

      // Should handle extras
      expect(results.some(r => r.packageName === 'pkg-with-extras')).toBe(true);

      // Should handle @ URL syntax
      expect(results.some(r => r.version === 'git+')).toBe(true);
    });
  });

  describe('Go Parser', () => {
    it('should parse go-real/go.mod', () => {
      const content = readFixture('go-real/go.mod');
      const diff = toDiff(content);
      const results = parseGo(diff);

      expect(results.length).toBeGreaterThan(0);

      // Should parse versions
      expect(results.every(r => r.version)).toBe(true);

      // Should handle indirect dependencies
      expect(results.some(r => r.version.includes('-indirect'))).toBe(true);

      // Should handle replace directives
      expect(results.some(r => r.packageName === 'github.com/new/pkg')).toBe(true);
    });
  });

  describe('Rust Parser', () => {
    it('should parse rust-real/Cargo.toml', () => {
      const content = readFixture('rust-real/Cargo.toml');
      const diff = toDiff(content);
      const results = parseRust(diff);

      expect(results.length).toBeGreaterThan(0);

      // Should handle git dependencies
      expect(results.some(r => r.version === 'git')).toBe(true);

      // Should handle target-specific dependencies
      expect(results.some(r => r.packageName === 'winapi')).toBe(true);

      // Should skip path dependencies (not present in results)
      expect(results.every(r => r.version !== 'path')).toBe(true);
    });
  });

  describe('Ruby Parser', () => {
    it('should parse ruby-real/Gemfile', () => {
      const content = readFixture('ruby-real/Gemfile');
      const diff = toDiff(content);
      const results = parseRuby(diff);

      expect(results.length).toBeGreaterThan(0);

      // Should handle git dependencies
      expect(results.some(r => r.version === 'git+')).toBe(true);

      // Should handle gems without versions
      expect(results.some(r => r.version === 'latest')).toBe(true);

      // Should skip path dependencies
      expect(results.every(r => r.packageName !== 'local-gem')).toBe(true);
    });
  });

  describe('PHP Parser', () => {
    it('should parse php-real/composer.json', () => {
      const content = readFixture('php-real/composer.json');
      const diff = toDiff(content);
      const results = parsePhp(diff);

      expect(results.length).toBeGreaterThan(0);

      // Should parse vendor/package format
      expect(results.some(r => r.packageName.includes('/'))).toBe(true);

      // Should skip php, ext-*, lib-* packages
      expect(results.every(r => r.packageName !== 'php')).toBe(true);
      expect(results.every(r => !r.packageName.startsWith('ext-'))).toBe(true);
      expect(results.every(r => !r.packageName.startsWith('lib-'))).toBe(true);
    });
  });

  describe('.NET Parser', () => {
    it('should parse dotnet-real/project.csproj', () => {
      const content = readFixture('dotnet-real/project.csproj');
      const diff = toDiff(content);
      const results = parseDotnet(diff, 'project.csproj');

      expect(results.length).toBeGreaterThan(0);

      // Should handle packages with versions
      expect(results.some(r => r.packageName === 'Newtonsoft.Json')).toBe(true);

      // Should handle packages without Version attribute
      expect(results.some(r => r.version === 'latest')).toBe(true);
    });
  });

  describe('Cross-Parser Compatibility', () => {
    it('should handle BOM in all parsers', () => {
      const bomContent = '\uFEFF{"dependencies": {"test": "1.0.0"}}';
      const diff = toDiff(bomContent);

      expect(() => parseNpm(diff)).not.toThrow();
      expect(() => parsePython(diff, 'requirements.txt')).not.toThrow();
      expect(() => parseGo(diff)).not.toThrow();
      expect(() => parseRust(diff)).not.toThrow();
      expect(() => parseRuby(diff)).not.toThrow();
      expect(() => parsePhp(diff)).not.toThrow();
      expect(() => parseDotnet(diff, 'test.csproj')).not.toThrow();
    });

    it('should handle different line endings', () => {
      const crlfContent = 'test==1.0.0\r\nother==2.0.0';
      const diff = toDiff(crlfContent);

      const results = parsePython(diff, 'requirements.txt');
      expect(results.length).toBe(2);
    });

    it('should handle empty input', () => {
      const emptyDiff = '';

      expect(parseNpm(emptyDiff)).toEqual([]);
      expect(parsePython(emptyDiff, 'requirements.txt')).toEqual([]);
      expect(parseGo(emptyDiff)).toEqual([]);
      expect(parseRust(emptyDiff)).toEqual([]);
      expect(parseRuby(emptyDiff)).toEqual([]);
      expect(parsePhp(emptyDiff)).toEqual([]);
      expect(parseDotnet(emptyDiff, 'test.csproj')).toEqual([]);
    });

    it('should never throw on invalid input', () => {
      const invalidInputs = [
        'random garbage',
        '!@#$%^&*()',
        '\0\0\0',
        '<?xml version="1.0"?><invalid>',
        '{"broken": json',
      ];

      for (const invalid of invalidInputs) {
        const diff = toDiff(invalid);

        expect(() => parseNpm(diff)).not.toThrow();
        expect(() => parsePython(diff, 'requirements.txt')).not.toThrow();
        expect(() => parseGo(diff)).not.toThrow();
        expect(() => parseRust(diff)).not.toThrow();
        expect(() => parseRuby(diff)).not.toThrow();
        expect(() => parsePhp(diff)).not.toThrow();
        expect(() => parseDotnet(diff, 'test.csproj')).not.toThrow();
      }
    });
  });

  describe('Real-World Compatibility', () => {
    it('should extract packages from all real fixtures', () => {
      const realFixtures = [
        { file: 'npm-real/package.json', parser: parseNpm, filename: 'package.json' },
        { file: 'python-real/requirements.txt', parser: parsePython, filename: 'requirements.txt' },
        { file: 'go-real/go.mod', parser: parseGo, filename: 'go.mod' },
        { file: 'rust-real/Cargo.toml', parser: parseRust, filename: 'Cargo.toml' },
        { file: 'ruby-real/Gemfile', parser: parseRuby, filename: 'Gemfile' },
        { file: 'php-real/composer.json', parser: parsePhp, filename: 'composer.json' },
        { file: 'dotnet-real/project.csproj', parser: parseDotnet, filename: 'project.csproj' },
      ];

      for (const fixture of realFixtures) {
        const content = readFixture(fixture.file);
        const diff = toDiff(content);
        const results = fixture.filename.includes('.')
          ? (fixture.parser as any)(diff, fixture.filename)
          : (fixture.parser as any)(diff);

        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);

        // All results should have required fields
        for (const result of results) {
          expect(result.packageName).toBeDefined();
          expect(typeof result.packageName).toBe('string');
          expect(result.packageName.length).toBeGreaterThan(0);

          expect(result.version).toBeDefined();
          expect(typeof result.version).toBe('string');

          expect(result.line).toBeDefined();
          expect(typeof result.line).toBe('number');
          expect(result.line).toBeGreaterThan(0);
        }
      }
    });
  });
});
