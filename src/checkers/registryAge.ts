import { Ecosystem, RiskSignal } from '../types';

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ghostdeps/1.0'
      }
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    return null;
  }
}

async function checkNpmAge(packageName: string): Promise<Date | null> {
  try {
    const response = await fetchWithTimeout(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);
    if (!response || !response.ok) return null;

    const data = await response.json();
    if (data.time?.created) {
      return new Date(data.time.created);
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function checkPyPIAge(packageName: string): Promise<Date | null> {
  try {
    const response = await fetchWithTimeout(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`);
    if (!response || !response.ok) return null;

    const data = await response.json();
    if (data.releases) {
      const versions = Object.keys(data.releases);
      if (versions.length === 0) return null;

      // Find earliest release date
      let earliestDate: Date | null = null;
      for (const version of versions) {
        const releases = data.releases[version];
        if (releases && releases.length > 0 && releases[0].upload_time) {
          const date = new Date(releases[0].upload_time);
          if (!earliestDate || date < earliestDate) {
            earliestDate = date;
          }
        }
      }
      return earliestDate;
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function checkRubyGemsAge(packageName: string): Promise<Date | null> {
  try {
    const response = await fetchWithTimeout(`https://rubygems.org/api/v1/gems/${encodeURIComponent(packageName)}.json`);
    if (!response || !response.ok) return null;

    const data = await response.json();
    if (data.created_at) {
      return new Date(data.created_at);
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function checkCratesIOAge(packageName: string): Promise<Date | null> {
  try {
    const response = await fetchWithTimeout(`https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}`);
    if (!response || !response.ok) return null;

    const data = await response.json();
    if (data.crate?.created_at) {
      return new Date(data.crate.created_at);
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function checkGoProxyAge(packageName: string): Promise<Date | null> {
  try {
    const response = await fetchWithTimeout(`https://proxy.golang.org/${encodeURIComponent(packageName)}/@v/list`);
    if (!response || !response.ok) return null;

    const text = await response.text();
    const versions = text.trim().split('\n').filter(v => v);

    if (versions.length === 0) return null;

    // Try to get info for the earliest version
    const firstVersion = versions[0];
    const infoResponse = await fetchWithTimeout(`https://proxy.golang.org/${encodeURIComponent(packageName)}/@v/${encodeURIComponent(firstVersion)}.info`);
    if (!infoResponse || !infoResponse.ok) return null;

    const info = await infoResponse.json();
    if (info.Time) {
      return new Date(info.Time);
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function checkPackagistAge(packageName: string): Promise<Date | null> {
  try {
    const response = await fetchWithTimeout(`https://repo.packagist.org/p2/${encodeURIComponent(packageName)}.json`);
    if (!response || !response.ok) return null;

    const data = await response.json();
    if (data.packages?.[packageName]) {
      const versions = Object.values(data.packages[packageName]) as any[];
      if (versions.length > 0) {
        // Find earliest time
        let earliestDate: Date | null = null;
        for (const version of versions) {
          if (version.time) {
            const date = new Date(version.time);
            if (!earliestDate || date < earliestDate) {
              earliestDate = date;
            }
          }
        }
        return earliestDate;
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function checkNuGetAge(packageName: string): Promise<Date | null> {
  try {
    const lowerPackageName = packageName.toLowerCase();
    const response = await fetchWithTimeout(`https://api.nuget.org/v3/registration5-gz-semver2/${encodeURIComponent(lowerPackageName)}/index.json`);
    if (!response || !response.ok) return null;

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const firstItem = data.items[0];
      if (firstItem.items && firstItem.items.length > 0) {
        const firstVersion = firstItem.items[0];
        if (firstVersion.catalogEntry?.published) {
          return new Date(firstVersion.catalogEntry.published);
        }
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

export async function checkRegistryAge(
  packageName: string,
  ecosystem: Ecosystem
): Promise<RiskSignal | null> {
  let createdDate: Date | null = null;

  switch (ecosystem) {
    case 'npm':
      createdDate = await checkNpmAge(packageName);
      break;
    case 'python':
      createdDate = await checkPyPIAge(packageName);
      break;
    case 'ruby':
      createdDate = await checkRubyGemsAge(packageName);
      break;
    case 'rust':
      createdDate = await checkCratesIOAge(packageName);
      break;
    case 'go':
      createdDate = await checkGoProxyAge(packageName);
      break;
    case 'php':
      createdDate = await checkPackagistAge(packageName);
      break;
    case 'dotnet':
      createdDate = await checkNuGetAge(packageName);
      break;
    default:
      return null;
  }

  if (!createdDate) return null;

  const now = new Date();
  const ageInDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays < 7) {
    return {
      signal: 'registryAge',
      severity: 'high',
      detail: `Published ${Math.floor(ageInDays)} day(s) ago — very new package`
    };
  }

  if (ageInDays < 30) {
    return {
      signal: 'registryAge',
      severity: 'medium',
      detail: `Published ${Math.floor(ageInDays)} day(s) ago — recently created`
    };
  }

  return null;
}
