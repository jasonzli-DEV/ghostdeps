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

    let content = line.substring(1).trim();

    // Skip empty lines, comments, and pip options
    if (!content || content.startsWith('#')) continue;
    if (content.startsWith('-r') || content.startsWith('-c') || content.startsWith('-e')) continue;

    try {
      let packageName = '';
      let version: string | null = null;

      // Step 5: Check for VCS URLs with #egg= syntax FIRST (before stripping #)
      if (content.match(/^git\+https?:\/\//i) || content.match(/^hg\+/i) || content.match(/^svn\+/i) || content.match(/^bzr\+/i)) {
        const eggMatch = content.match(/#egg=([a-zA-Z0-9_.-]+)/);
        if (eggMatch) {
          packageName = eggMatch[1];
        } else {
          // Extract package name from URL if no #egg= specified
          const urlMatch = content.match(/\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:[#@]|$)/);
          packageName = urlMatch ? urlMatch[1] : 'unknown-git-package';
        }
        version = 'git+';

        results.push({
          packageName,
          version,
          line: currentLineNumber
        });
        continue;
      }

      // Step 1: Strip inline comments (after unquoted #)
      const hashIndex = content.indexOf('#');
      if (hashIndex !== -1) {
        // Simple approach: if there's a #, take everything before it
        // This won't handle quotes perfectly, but requirements.txt rarely uses quotes
        content = content.substring(0, hashIndex).trim();
        if (!content) continue;
      }

      // Step 2: Strip environment markers (after unquoted ;)
      const semiIndex = content.indexOf(';');
      if (semiIndex !== -1) {
        content = content.substring(0, semiIndex).trim();
        if (!content) continue;
      }

      // Step 3: Strip pip flags (--anything)
      content = content.replace(/\s+--[a-z-]+(?:\s+[^\s]+)?/gi, '').trim();
      if (!content) continue;

      // Step 4: Check for @ URL syntax (e.g., "pkg @ https://...")
      const atUrlMatch = content.match(/^([a-zA-Z0-9_.-]+(?:\[[^\]]+\])?)\s+@\s+(.+)$/);
      if (atUrlMatch) {
        packageName = atUrlMatch[1];
        version = 'git+'; // Flag as MEDIUM

        // Strip extras from package name
        packageName = packageName.replace(/\[[^\]]+\]/, '');

        results.push({
          packageName,
          version,
          line: currentLineNumber
        });
        continue;
      }

      // Step 6 & 7: Parse standard package with optional extras and version specifiers
      // Pattern: package-name[extras]==version or package-name>=version or just package-name
      const pkgMatch = content.match(/^([a-zA-Z0-9_.-]+)(?:\[[^\]]+\])?(?:\s*([=<>!~]+)\s*([^\s;#]+))?/);
      if (pkgMatch) {
        packageName = pkgMatch[1];
        version = pkgMatch[3] || null;

        if (packageName) {
          results.push({
            packageName,
            version: version || 'latest',
            line: currentLineNumber
          });
        }
      }
    } catch (error) {
      // On any line error: skip, log debug, continue — never throw
      continue;
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
