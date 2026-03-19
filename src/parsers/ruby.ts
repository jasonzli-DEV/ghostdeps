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

export function parseRuby(diffContent: string): ParsedDependency[] {
  try {
    const content = normalizeLineEndings(stripBOM(diffContent));
    const lines = content.split('\n');
    const results: ParsedDependency[] = [];

    let currentLineNumber = 0;

    for (const line of lines) {
      currentLineNumber++;

      if (!line.trim().startsWith('+')) continue;

      const content = line.substring(1).trim();

      // Parse gem 'name', 'version' or gem "name", "version"
      // Also handle: gem 'name', '~> version'
      const singleQuoteMatch = content.match(/^gem\s+['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
      if (singleQuoteMatch) {
        const packageName = singleQuoteMatch[1];
        let version = singleQuoteMatch[2];

        // Clean up version specifiers
        version = version.replace(/^[~><=\s]+/, '');

        results.push({
          packageName,
          version,
          line: currentLineNumber
        });
        continue;
      }

      // Handle gem 'name' without explicit version (will be 'latest')
      const noVersionMatch = content.match(/^gem\s+['"]([^'"]+)['"]\s*$/);
      if (noVersionMatch) {
        results.push({
          packageName: noVersionMatch[1],
          version: 'latest',
          line: currentLineNumber
        });
      }
    }

    return results;
  } catch (error) {
    return [];
  }
}
