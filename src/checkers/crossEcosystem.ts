import { Ecosystem, RiskSignal } from '../types';

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
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

async function checkPackageExists(packageName: string, ecosystem: Ecosystem): Promise<boolean> {
  try {
    let response: Response | null = null;

    if (ecosystem === 'npm') {
      response = await fetchWithTimeout(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);
    } else if (ecosystem === 'python') {
      response = await fetchWithTimeout(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`);
    }

    return response !== null && response.ok;
  } catch (error) {
    return false;
  }
}

export async function checkCrossEcosystem(
  packageName: string,
  ecosystem: Ecosystem
): Promise<RiskSignal | null> {
  // Only check cross-pollution between npm and python
  if (ecosystem !== 'npm' && ecosystem !== 'python') {
    return null;
  }

  const targetEcosystem: Ecosystem = ecosystem === 'npm' ? 'python' : 'npm';
  const exists = await checkPackageExists(packageName, targetEcosystem);

  if (exists) {
    return {
      signal: 'crossEcosystem',
      severity: 'medium',
      detail: `Package name also exists in ${targetEcosystem} — possible confusion attack`
    };
  }

  return null;
}
