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

async function checkNpmDownloads(packageName: string): Promise<number | null> {
  try {
    const response = await fetchWithTimeout(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`);
    if (!response || !response.ok) return null;

    const data: any = await response.json();
    if (typeof data.downloads === 'number') {
      return data.downloads;
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function checkPyPIDownloads(packageName: string): Promise<number | null> {
  try {
    const response = await fetchWithTimeout(`https://pypistats.org/api/packages/${encodeURIComponent(packageName)}/recent`);
    if (!response || !response.ok) return null;

    const data: any = await response.json();
    if (data.data?.last_week) {
      return data.data.last_week;
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function checkPackageAge(packageName: string, ecosystem: Ecosystem): Promise<number | null> {
  // Reuse age checking logic from registryAge
  // We need to check if package is < 30 days old
  try {
    if (ecosystem === 'npm') {
      const response = await fetchWithTimeout(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);
      if (!response || !response.ok) return null;
      const data: any = await response.json();
      if (data.time?.created) {
        const createdDate = new Date(data.time.created);
        const ageInDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        return ageInDays;
      }
    } else if (ecosystem === 'python') {
      const response = await fetchWithTimeout(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`);
      if (!response || !response.ok) return null;
      const data: any = await response.json();
      if (data.releases) {
        const versions = Object.keys(data.releases);
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
        if (earliestDate) {
          const ageInDays = (Date.now() - earliestDate.getTime()) / (1000 * 60 * 60 * 24);
          return ageInDays;
        }
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

export async function checkDownloadVelocity(
  packageName: string,
  ecosystem: Ecosystem
): Promise<RiskSignal | null> {
  // Only check npm and python
  if (ecosystem !== 'npm' && ecosystem !== 'python') {
    return null;
  }

  // First check if package is young enough to care about download velocity
  const ageInDays = await checkPackageAge(packageName, ecosystem);
  if (ageInDays === null || ageInDays >= 30) {
    // Package is too old or we couldn't determine age - don't flag on downloads
    return null;
  }

  let downloads: number | null = null;

  if (ecosystem === 'npm') {
    downloads = await checkNpmDownloads(packageName);
  } else if (ecosystem === 'python') {
    downloads = await checkPyPIDownloads(packageName);
  }

  if (downloads === null) return null;

  // Only flag if package is < 30 days old AND has low downloads
  if (downloads < 10) {
    return {
      signal: 'downloadVelocity',
      severity: 'high',
      detail: `Only ${downloads} downloads/week for new package`
    };
  }

  if (downloads < 100) {
    return {
      signal: 'downloadVelocity',
      severity: 'medium',
      detail: `Only ${downloads} downloads/week for new package`
    };
  }

  return null;
}
