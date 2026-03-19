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

export function parsePhp(diffContent: string): ParsedDependency[] {
  try {
    const content = normalizeLineEndings(stripBOM(diffContent));
    const lines = content.split('\n');
    const results: ParsedDependency[] = [];

    let currentLineNumber = 0;
    let inRequireBlock = false;
    let braceDepth = 0;
    let topLevelBraceDepth = 0;

    for (const line of lines) {
      currentLineNumber++;

      // Track brace depth
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }

      // Check if we're entering a require or require-dev block
      const requireMatch = line.match(/^\+?\s*"(require|require-dev)"\s*:/);
      if (requireMatch) {
        inRequireBlock = true;
        topLevelBraceDepth = braceDepth;
        continue;
      }

      // Exit require block
      if (inRequireBlock && braceDepth <= topLevelBraceDepth - 1) {
        inRequireBlock = false;
      }

      if (!inRequireBlock) continue;
      if (!line.trim().startsWith('+')) continue;

      const content = line.substring(1).trim();

      // Parse dependency line: "vendor/package": "^1.0"
      const match = content.match(/^"([^"]+)"\s*:\s*"([^"]+)"/);
      if (match) {
        const packageName = match[1];
        const version = match[2];

        // Skip the "php" version constraint
        if (packageName.toLowerCase() === 'php') {
          continue;
        }

        results.push({
          packageName,
          version,
          line: currentLineNumber
        });
      }
    }

    return results;
  } catch (error) {
    return [];
  }
}
