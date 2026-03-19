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

      // Skip empty lines, comments, source/group declarations
      if (!content || content.startsWith('#')) continue;
      if (content.match(/^(source|group|platforms?)\s/)) continue;
      if (content.match(/^(end|do)\s*$/)) continue;

      // Skip path dependencies
      if (content.match(/path:/)) continue;

      // Parse gem with git/github options (flag as MEDIUM)
      const gitMatch = content.match(/^gem\s+['"]([^'"]+)['"].*?(git|github):/);
      if (gitMatch) {
        results.push({
          packageName: gitMatch[1],
          version: 'git+',
          line: currentLineNumber
        });
        continue;
      }

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
      // But not if it has options like platforms, require, etc on the same line
      const noVersionMatch = content.match(/^gem\s+['"]([^'"]+)['"]\s*(?:,\s*(.+))?$/);
      if (noVersionMatch) {
        const packageName = noVersionMatch[1];
        const options = noVersionMatch[2];

        // If there are options, check if they're just platform/require options (not version)
        if (!options || options.match(/^(platforms?|require):/)) {
          results.push({
            packageName,
            version: 'latest',
            line: currentLineNumber
          });
        }
      }
    }

    return results;
  } catch (error) {
    return [];
  }
}
