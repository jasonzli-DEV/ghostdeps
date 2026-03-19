import { parseNpm } from '../npm';

describe('parseNpm', () => {
  it('should parse added dependencies', () => {
    const diff = `
+  "dependencies": {
+    "react": "^18.2.0",
+    "lodash": "^4.17.21"
+  }
`;
    const result = parseNpm(diff);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ packageName: 'react', version: '^18.2.0', line: expect.any(Number) });
    expect(result[1]).toEqual({ packageName: 'lodash', version: '^4.17.21', line: expect.any(Number) });
  });

  it('should parse scoped packages', () => {
    const diff = `
+  "dependencies": {
+    "@babel/core": "^7.22.0"
+  }
`;
    const result = parseNpm(diff);
    expect(result).toHaveLength(1);
    expect(result[0].packageName).toBe('@babel/core');
  });

  it('should handle devDependencies, peerDependencies, and optionalDependencies', () => {
    const diff = `
+  "devDependencies": {
+    "jest": "^29.0.0"
+  },
+  "peerDependencies": {
+    "react": ">=16.0.0"
+  }
`;
    const result = parseNpm(diff);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle CRLF line endings', () => {
    const diff = "+  \"dependencies\": {\r\n+    \"react\": \"^18.2.0\"\r\n+  }";
    const result = parseNpm(diff);
    expect(result).toHaveLength(1);
  });

  it('should handle UTF-8 BOM', () => {
    const diff = '\uFEFF+  "dependencies": {\n+    "react": "^18.2.0"\n+  }';
    const result = parseNpm(diff);
    expect(result).toHaveLength(1);
  });

  it('should handle malformed input without throwing', () => {
    const diff = 'this is not valid JSON diff';
    expect(() => parseNpm(diff)).not.toThrow();
    const result = parseNpm(diff);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array for empty input', () => {
    const result = parseNpm('');
    expect(result).toEqual([]);
  });
});
