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

function parseRequirementsTxt(diffContent: string): ParsedDependency[] {
  const results: ParsedDependency[] = [];
  const lines = diffContent.split('\n');

  let currentLineNumber = 0;
  for (const line of lines) {
    currentLineNumber++;

    if (!line.trim().startsWith('+')) continue;

    const content = line.substring(1).trim();

    // Skip empty lines, comments, and options
    if (!content || content.startsWith('#') || content.startsWith('-')) continue;

    // Check for git URLs - flag as medium risk with special version
    if (content.match(/^git\+https?:\/\//i)) {
      const gitMatch = content.match(/git\+https?:\/\/[^#@]+\/([^/\s#@]+?)(?:\.git)?(?:[#@]|$)/i);
      if (gitMatch) {
        results.push({
          packageName: gitMatch[1],
          version: 'git+',
          line: currentLineNumber
        });
      }
      continue;
    }

    // Parse standard requirement line: pkg==1.0, pkg>=2.0, pkg~=1.0, etc.
    const match = content.match(/^([a-zA-Z0-9_-]+[a-zA-Z0-9._-]*)\s*([=<>!~]+)\s*([^\s;#]+)/);
    if (match) {
      const packageName = match[1];
      const version = match[3];

      results.push({
        packageName,
        version,
        line: currentLineNumber
      });
    }
  }

  return results;
}

function parsePyprojectToml(diffContent: string): ParsedDependency[] {
  const results: ParsedDependency[] = [];
  const lines = diffContent.split('\n');

  let currentLineNumber = 0;
  let inDependenciesBlock = false;

  for (const line of lines) {
    currentLineNumber++;

    // Check for dependencies sections
    if (line.match(/^\+?\s*\[(project\.)?dependencies\]/i) ||
        line.match(/^\+?\s*\[tool\.poetry\.dependencies\]/i) ||
        line.match(/^\+?\s*\[tool\.poetry\.dev-dependencies\]/i)) {
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

    // Parse TOML dependency: "package = "version"" or "package = { version = "version" }"
    const simpleMatch = content.match(/^["']?([a-zA-Z0-9_-]+[a-zA-Z0-9._-]*)["']?\s*=\s*["']([^"']+)["']/);
    if (simpleMatch) {
      results.push({
        packageName: simpleMatch[1],
        version: simpleMatch[2],
        line: currentLineNumber
      });
      continue;
    }

    // Parse inline table format
    const inlineMatch = content.match(/^["']?([a-zA-Z0-9_-]+[a-zA-Z0-9._-]*)["']?\s*=\s*\{[^}]*version\s*=\s*["']([^"']+)["']/);
    if (inlineMatch) {
      results.push({
        packageName: inlineMatch[1],
        version: inlineMatch[2],
        line: currentLineNumber
      });
    }
  }

  return results;
}

function parsePipfile(diffContent: string): ParsedDependency[] {
  const results: ParsedDependency[] = [];
  const lines = diffContent.split('\n');

  let currentLineNumber = 0;
  let inPackagesBlock = false;

  for (const line of lines) {
    currentLineNumber++;

    // Check for [packages] or [dev-packages] sections
    if (line.match(/^\+?\s*\[(packages|dev-packages)\]/i)) {
      inPackagesBlock = true;
      continue;
    }

    // Exit block on new section
    if (inPackagesBlock && line.match(/^\+?\s*\[/)) {
      inPackagesBlock = false;
      continue;
    }

    if (!inPackagesBlock) continue;
    if (!line.trim().startsWith('+')) continue;

    const content = line.substring(1).trim();
    if (!content || content.startsWith('#')) continue;

    // Parse Pipfile format: package = "==1.0.0" or package = "*"
    const match = content.match(/^([a-zA-Z0-9_-]+[a-zA-Z0-9._-]*)\s*=\s*["']([^"']+)["']/);
    if (match) {
      const packageName = match[1];
      let version = match[2];

      // Convert "*" to a reasonable default
      if (version === '*') {
        version = 'latest';
      }

      results.push({
        packageName,
        version,
        line: currentLineNumber
      });
    }
  }

  return results;
}

export function parsePython(diffContent: string, filename: string): ParsedDependency[] {
  try {
    const content = normalizeLineEndings(stripBOM(diffContent));

    const lowerFilename = filename.toLowerCase();

    if (lowerFilename.includes('requirements') && lowerFilename.endsWith('.txt')) {
      return parseRequirementsTxt(content);
    } else if (lowerFilename.includes('pyproject.toml')) {
      return parsePyprojectToml(content);
    } else if (lowerFilename.includes('pipfile')) {
      return parsePipfile(content);
    }

    return [];
  } catch (error) {
    return [];
  }
}
