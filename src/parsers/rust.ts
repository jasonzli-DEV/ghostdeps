export interface ParsedDependency {
  packageName: string;
  version: string;
  line: number;
}

function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function parseRust(diffContent: string): ParsedDependency[] {
  try {
    const content = normalizeLineEndings(stripBOM(diffContent));
    const lines = content.split('\n');
    const results: ParsedDependency[] = [];

    let currentLineNumber = 0;
    let inDependenciesBlock = false;

    for (const line of lines) {
      currentLineNumber++;

      // Check for dependencies sections
      if (line.match(/^\+?\s*\[(dependencies|dev-dependencies|build-dependencies)\]/i)) {
        inDependenciesBlock = true;
        continue;
      }

      // Exit block on new section
      if (inDependenciesBlock && line.match(/^\+?\s*\[/)) {
        inDependenciesBlock = false;
        continue;
      }

      if (!inDependenciesBlock) continue;
      if (!line.trim().startsWith('+')) continue;

      const content = line.substring(1).trim();
      if (!content || content.startsWith('#')) continue;

      // Parse simple version: package = "1.0.0"
      const simpleMatch = content.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
      if (simpleMatch) {
        results.push({
          packageName: simpleMatch[1],
          version: simpleMatch[2],
          line: currentLineNumber
        });
        continue;
      }

      // Parse inline table: package = { version = "1.0.0" }
      const inlineMatch = content.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/);
      if (inlineMatch) {
        results.push({
          packageName: inlineMatch[1],
          version: inlineMatch[2],
          line: currentLineNumber
        });
        continue;
      }

      // Check for workspace = true (no version to check)
      const workspaceMatch = content.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{[^}]*workspace\s*=\s*true/);
      if (workspaceMatch) {
        results.push({
          packageName: workspaceMatch[1],
          version: 'workspace',
          line: currentLineNumber
        });
        continue;
      }

      // Check for git dependencies (flag as MEDIUM risk)
      const gitMatch = content.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{[^}]*git\s*=/);
      if (gitMatch) {
        results.push({
          packageName: gitMatch[1],
          version: 'git',
          line: currentLineNumber
        });
      }
    }

    return results;
  } catch (error) {
    return [];
  }
}
