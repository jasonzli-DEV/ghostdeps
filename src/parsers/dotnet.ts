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

export function parseDotnet(diffContent: string, filename: string): ParsedDependency[] {
  try {
    const content = normalizeLineEndings(stripBOM(diffContent));
    const lines = content.split('\n');
    const results: ParsedDependency[] = [];

    const lowerFilename = filename.toLowerCase();

    let currentLineNumber = 0;

    for (const line of lines) {
      currentLineNumber++;

      if (!line.trim().startsWith('+')) continue;

      const content = line.substring(1).trim();

      if (lowerFilename.endsWith('.csproj') || lowerFilename.endsWith('.vbproj') || lowerFilename.endsWith('.fsproj')) {
        // Parse .csproj format: <PackageReference Include="Package.Name" Version="1.0.0" />
        // Case-insensitive attribute matching
        const match = content.match(/<PackageReference\s+Include\s*=\s*"([^"]+)"[^>]*Version\s*=\s*"([^"]+)"/i);
        if (match) {
          results.push({
            packageName: match[1],
            version: match[2],
            line: currentLineNumber
          });
        }
      } else if (lowerFilename.includes('packages.config')) {
        // Parse packages.config format: <package id="Package.Name" version="1.0.0" />
        // Case-insensitive attribute matching
        const match = content.match(/<package\s+id\s*=\s*"([^"]+)"[^>]*version\s*=\s*"([^"]+)"/i);
        if (match) {
          results.push({
            packageName: match[1],
            version: match[2],
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
