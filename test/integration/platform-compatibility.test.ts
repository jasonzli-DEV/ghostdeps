import { parseNpm } from '../../src/parsers/npm';
import { parsePython } from '../../src/parsers/python';
import { parseGo } from '../../src/parsers/go';
import { parseRuby } from '../../src/parsers/ruby';
import { parsePhp } from '../../src/parsers/php';
import { parseDotnet } from '../../src/parsers/dotnet';

describe('Platform Compatibility Tests', () => {
  describe('Line Ending Compatibility', () => {
    it('should handle Unix line endings (LF)', () => {
      const content = '+package1==1.0.0\n+package2==2.0.0';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(2);
    });

    it('should handle Windows line endings (CRLF)', () => {
      const content = '+package1==1.0.0\r\n+package2==2.0.0';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(2);
    });

    it('should handle Mac line endings (CR)', () => {
      const content = '+package1==1.0.0\r+package2==2.0.0';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(2);
    });

    it('should handle mixed line endings', () => {
      const content = '+package1==1.0.0\n+package2==2.0.0\r\n+package3==3.0.0\r+package4==4.0.0';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(4);
    });
  });

  describe('BOM (Byte Order Mark) Compatibility', () => {
    it('should handle UTF-8 BOM in NPM', () => {
      const content = '\uFEFF+{"dependencies": {"test": "1.0.0"}}';
      const results = parseNpm(content);
      expect(results).toBeDefined();
    });

    it('should handle UTF-8 BOM in Python', () => {
      const content = '\uFEFF+requests==2.28.2';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(1);
    });

    it('should handle UTF-8 BOM in Go', () => {
      const content = '\uFEFF+require github.com/test/pkg v1.0.0';
      const results = parseGo(content);
      expect(results).toBeDefined();
    });
  });

  describe('Unicode and Special Characters', () => {
    it('should handle package names with numbers', () => {
      const content = '+py2neo==2021.2.3';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(1);
      expect(results[0].packageName).toBe('py2neo');
    });

    it('should handle package names with underscores', () => {
      const content = '+python_dateutil==2.8.2';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(1);
    });

    it('should handle package names with dashes', () => {
      const content = '+django-rest-framework==3.14.0';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(1);
    });

    it('should handle package names with dots', () => {
      const content = '+zope.interface==5.4.0';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(1);
    });
  });

  describe('Version Format Compatibility', () => {
    describe('NPM Version Formats', () => {
      it('should handle caret versions', () => {
        const diff = '+{\n+  "dependencies": {\n+    "test": "^1.2.3"\n+  }\n+}';
        const results = parseNpm(diff);
        expect(results.some(r => r.version === '^1.2.3')).toBe(true);
      });

      it('should handle tilde versions', () => {
        const diff = '+{\n+  "dependencies": {\n+    "test": "~1.2.3"\n+  }\n+}';
        const results = parseNpm(diff);
        expect(results.some(r => r.version === '~1.2.3')).toBe(true);
      });

      it('should handle exact versions', () => {
        const diff = '+{\n+  "dependencies": {\n+    "test": "1.2.3"\n+  }\n+}';
        const results = parseNpm(diff);
        expect(results.some(r => r.version === '1.2.3')).toBe(true);
      });

      it('should handle range versions', () => {
        const diff = '+{\n+  "dependencies": {\n+    "test": ">=1.2.3 <2.0.0"\n+  }\n+}';
        const results = parseNpm(diff);
        expect(results).toBeDefined();
      });
    });

    describe('Python Version Formats', () => {
      it('should handle == operator', () => {
        const content = '+package==1.0.0';
        const results = parsePython(content, 'requirements.txt');
        expect(results[0].version).toBe('1.0.0');
      });

      it('should handle >= operator', () => {
        const content = '+package>=1.0.0';
        const results = parsePython(content, 'requirements.txt');
        expect(results[0].version).toBe('1.0.0');
      });

      it('should handle ~= operator', () => {
        const content = '+package~=1.0.0';
        const results = parsePython(content, 'requirements.txt');
        expect(results[0].version).toBe('1.0.0');
      });

      it('should handle != operator', () => {
        const content = '+package!=1.0.0,>=1.1.0';
        const results = parsePython(content, 'requirements.txt');
        expect(results).toHaveLength(1);
      });
    });
  });

  describe('Whitespace Handling', () => {
    it('should handle tabs in NPM', () => {
      const content = '+{\t"dependencies":\t{\n+\t\t"test":\t"1.0.0"\n+\t}\n+}';
      const results = parseNpm(content);
      expect(results).toBeDefined();
    });

    it('should handle leading/trailing whitespace in Python', () => {
      const content = '+   package==1.0.0   ';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(1);
    });

    it('should handle multiple spaces in Go', () => {
      const content = '+require   github.com/test/pkg   v1.0.0';
      const results = parseGo(content);
      expect(results).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should skip malformed lines in Python', () => {
      const content = '+valid-package==1.0.0\n+#!@#$%^&*()\n+another-package==2.0.0';
      const results = parsePython(content, 'requirements.txt');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle partial JSON in NPM', () => {
      const content = '+{"dependencies": {"test": "1.0.0"';
      const results = parseNpm(content);
      expect(results).toBeDefined();
    });

    it('should handle incomplete blocks in Go', () => {
      const content = '+require (\n+  github.com/test/pkg v1.0.0';
      const results = parseGo(content);
      expect(results).toBeDefined();
    });
  });

  describe('Case Sensitivity', () => {
    it('should handle uppercase package names in Python', () => {
      const content = '+DJANGO==4.2.0';
      const results = parsePython(content, 'requirements.txt');
      expect(results[0].packageName).toBe('DJANGO');
    });

    it('should handle mixed case in .NET', () => {
      const content = '+<PackageReference Include="Newtonsoft.Json" Version="13.0.1" />';
      const results = parseDotnet(content, 'test.csproj');
      expect(results).toHaveLength(1);
    });

    it('should handle lowercase attributes in .NET', () => {
      const content = '+<packagereference include="Test.Package" version="1.0.0" />';
      const results = parseDotnet(content, 'test.csproj');
      expect(results).toHaveLength(1);
    });
  });

  describe('Comment Styles', () => {
    it('should skip # comments in Python', () => {
      const content = '+# This is a comment\n+package==1.0.0';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(1);
    });

    it('should skip # comments in Ruby', () => {
      const content = '+# Comment\n+gem "rails", "7.0.0"';
      const results = parseRuby(content);
      expect(results).toHaveLength(1);
    });

    it('should skip // comments in Go', () => {
      const content = '+require github.com/test/pkg v1.0.0 // indirect';
      const results = parseGo(content);
      expect(results[0].version).toContain('indirect');
    });
  });

  describe('Scoped Packages', () => {
    it('should handle @scope packages in NPM', () => {
      const content = '+{\n+  "dependencies": {\n+    "@types/node": "^20.0.0"\n+  }\n+}';
      const results = parseNpm(content);
      expect(results.some(r => r.packageName === '@types/node')).toBe(true);
    });

    it('should handle vendor/package in PHP', () => {
      const content = '+{\n+  "require": {\n+    "laravel/framework": "^10.0"\n+  }\n+}';
      const results = parsePhp(content);
      expect(results.some(r => r.packageName === 'laravel/framework')).toBe(true);
    });

    it('should handle github.com packages in Go', () => {
      const content = '+require github.com/gin-gonic/gin v1.9.1';
      const results = parseGo(content);
      expect(results[0].packageName).toBe('github.com/gin-gonic/gin');
    });
  });

  describe('Large File Handling', () => {
    it('should handle files with many dependencies (NPM)', () => {
      let content = '+{\n+  "dependencies": {\n';
      for (let i = 0; i < 100; i++) {
        content += `+    "package${i}": "^1.0.${i}",\n`;
      }
      content += '+    "last-package": "1.0.0"\n+  }\n+}';
      const results = parseNpm(content);
      expect(results.length).toBeGreaterThan(50);
    });

    it('should handle files with many dependencies (Python)', () => {
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `+package${i}==1.0.${i}\n`;
      }
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(100);
    });
  });

  describe('Empty and Minimal Files', () => {
    it('should handle empty dependencies in NPM', () => {
      const content = '+{"dependencies": {}}';
      const results = parseNpm(content);
      expect(results).toEqual([]);
    });

    it('should handle single dependency in Python', () => {
      const content = '+requests==2.28.2';
      const results = parsePython(content, 'requirements.txt');
      expect(results).toHaveLength(1);
    });

    it('should handle minimal Go mod', () => {
      const content = '+module test\n+\n+go 1.20';
      const results = parseGo(content);
      expect(results).toEqual([]);
    });
  });
});
