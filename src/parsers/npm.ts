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

export function parseNpm(diffContent: string): ParsedDependency[] {
  try {
    const content = normalizeLineEndings(stripBOM(diffContent));
    const lines = content.split('\n');
    const results: ParsedDependency[] = [];

    let currentLineNumber = 0;
    let inDependenciesBlock = false;
    let braceDepth = 0;
    let topLevelBraceDepth = 0;
    let foundTopLevelDeps = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentLineNumber++;

      // Track brace depth
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }

      // Check if we're entering a dependencies block
      const depBlockMatch = line.match(/^\+?\s*"(dependencies|devDependencies|peerDependencies|optionalDependencies)"\s*:/);
      if (depBlockMatch) {
        inDependenciesBlock = true;
        topLevelBraceDepth = braceDepth;
        foundTopLevelDeps = true;
        continue;
      }

      // Exit dependencies block if we're back at the same brace level
      if (inDependenciesBlock && foundTopLevelDeps && braceDepth <= topLevelBraceDepth - 1) {
        inDependenciesBlock = false;
      }

      // Parse dependency line
      if (inDependenciesBlock && line.trim().startsWith('+')) {
        const depMatch = line.match(/^\+\s*"(@?[^"]+)"\s*:\s*"([^"]+)"/);
        if (depMatch) {
          const packageName = depMatch[1];
          const version = depMatch[2];

          // Skip empty or invalid entries
          if (packageName && version) {
            results.push({
              packageName,
              version,
              line: currentLineNumber
            });
          }
        }
      }
    }

    return results;
  } catch (error) {
    // Never throw - return empty array on any error
    return [];
  }
}
