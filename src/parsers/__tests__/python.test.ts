import { parsePython } from '../python';

describe('parsePython', () => {
  describe('requirements.txt', () => {
    it('should parse basic requirements', () => {
      const diff = `
+requests==2.28.2
+flask>=2.3.0
+django~=4.2.0
`;
      const result = parsePython(diff, 'requirements.txt');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ packageName: 'requests', version: '2.28.2', line: expect.any(Number) });
    });

    it('should handle git URLs', () => {
      const diff = `
+git+https://github.com/user/repo.git
`;
      const result = parsePython(diff, 'requirements.txt');
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe('git+');
    });

    it('should skip comments and empty lines', () => {
      const diff = `
+# This is a comment
+
+requests==2.28.2
`;
      const result = parsePython(diff, 'requirements.txt');
      expect(result).toHaveLength(1);
    });
  });

  describe('pyproject.toml', () => {
    it('should parse dependencies section', () => {
      const diff = `
+[project.dependencies]
+requests = "^2.28.0"
+flask = "^2.3.0"
`;
      const result = parsePython(diff, 'pyproject.toml');
      expect(result).toHaveLength(2);
    });

    it('should parse poetry dependencies', () => {
      const diff = `
+[tool.poetry.dependencies]
+python = "^3.9"
+requests = "^2.28.0"
`;
      const result = parsePython(diff, 'pyproject.toml');
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Pipfile', () => {
    it('should parse packages section', () => {
      const diff = `
+[packages]
+requests = "==2.28.2"
+flask = "*"
`;
      const result = parsePython(diff, 'Pipfile');
      expect(result).toHaveLength(2);
      expect(result[1].version).toBe('latest'); // "*" converted to "latest"
    });
  });

  it('should handle malformed input without throwing', () => {
    expect(() => parsePython('invalid', 'requirements.txt')).not.toThrow();
  });

  it('should return empty array for empty input', () => {
    const result = parsePython('', 'requirements.txt');
    expect(result).toEqual([]);
  });
});
