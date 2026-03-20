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

export function parseGo(diffContent: string): ParsedDependency[] {
  try {
    const content = normalizeLineEndings(stripBOM(diffContent));
    const lines = content.split('\n');
    const results: ParsedDependency[] = [];

    let currentLineNumber = 0;
    let inRequireBlock = false;

    for (const line of lines) {
      currentLineNumber++;

      // Check for require block start
      if (line.match(/^\+?\s*require\s*\(/)) {
        inRequireBlock = true;
        continue;
      }

      // Check for require block end
      if (inRequireBlock && line.match(/^\+?\s*\)/)) {
        inRequireBlock = false;
        continue;
      }

      if (!line.trim().startsWith('+')) continue;

      const content = line.substring(1).trim();

      // Parse single-line require
      const singleRequireMatch = content.match(/^require\s+([^\s]+)\s+([^\s]+)/);
      if (singleRequireMatch) {
        let version = singleRequireMatch[2];
        // Mark indirect dependencies with special version marker
        if (content.includes('// indirect')) {
          version += '-indirect';
        }

        results.push({
          packageName: singleRequireMatch[1],
          version,
          line: currentLineNumber
        });
        continue;
      }

      // Parse require block entry
      if (inRequireBlock) {
        const blockMatch = content.match(/^([^\s]+)\s+([^\s]+)/);
        if (blockMatch) {
          let version = blockMatch[2];
          // Mark indirect dependencies
          if (content.includes('// indirect')) {
            version += '-indirect';
          }

          results.push({
            packageName: blockMatch[1],
            version,
            line: currentLineNumber
          });
        }
      }

      // Handle replace directives - track replacement target as a new dependency
      const replaceMatch = content.match(/^replace\s+[^\s]+(?:\s+[^\s]+)?\s+=>\s+([^\s]+)\s+([^\s]+)/);
      if (replaceMatch) {
        results.push({
          packageName: replaceMatch[1],
          version: replaceMatch[2],
          line: currentLineNumber
        });
      }
    }

    return results;
  } catch (error) {
    return [];
  }
}
