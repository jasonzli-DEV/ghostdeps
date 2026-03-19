import { getOctokit } from '@actions/github';
import * as core from '@actions/core';
import { ScoredDependency } from './types';
import { topSignal } from './scorer';

type Octokit = ReturnType<typeof getOctokit>;

const COMMENT_MARKER = '<!-- ghostdeps-report -->';

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function generateReportMarkdown(
  scoredDeps: ScoredDependency[],
  sha: string
): string {
  if (scoredDeps.length === 0) {
    return `${COMMENT_MARKER}
## 👻 ghostdeps

✓ No new dependencies detected

Last scanned: \`${sha.substring(0, 7)}\` · ${formatRelativeTime(new Date())}

---
<sub>👻 [ghostdeps](https://github.com/jasonzli-DEV/ghostdeps) · [add to your repo](https://github.com/jasonzli-DEV/ghostdeps#install) · [false positive?](https://github.com/jasonzli-DEV/ghostdeps/issues/new) · If ghostdeps caught something useful, consider [⭐ starring the repo](https://github.com/jasonzli-DEV/ghostdeps) — it helps others find it.</sub>`;
  }

  const highDeps = scoredDeps.filter(d => d.riskLevel === 'high');
  const mediumDeps = scoredDeps.filter(d => d.riskLevel === 'medium');
  const lowDeps = scoredDeps.filter(d => d.riskLevel === 'low');

  let markdown = `${COMMENT_MARKER}
## 👻 ghostdeps

Scanned **${scoredDeps.length} new dependencies** · Last scanned: \`${sha.substring(0, 7)}\` · ${formatRelativeTime(new Date())}

`;

  // HIGH callout
  if (highDeps.length > 0) {
    markdown += `### ⚠️ ${highDeps.length} HIGH risk ${highDeps.length === 1 ? 'dependency' : 'dependencies'} detected

`;
  }

  // Show MEDIUM+ findings in expanded table
  const mediumPlusDeps = [...highDeps, ...mediumDeps];
  if (mediumPlusDeps.length > 0) {
    markdown += `| Risk | Package | Version | File | Details |\n`;
    markdown += `|------|---------|---------|------|----------|\n`;

    for (const dep of mediumPlusDeps) {
      const riskBadge = dep.riskLevel === 'high' ? '🔴 HIGH' : '🟡 MEDIUM';
      const details = topSignal(dep.signals);
      markdown += `| ${riskBadge} | \`${dep.packageName}\` | \`${dep.version}\` | \`${dep.file}\` | ${details} |\n`;
    }

    markdown += '\n';
  }

  // Show LOW findings in collapsed details
  if (lowDeps.length > 0) {
    if (mediumPlusDeps.length === 0) {
      // All LOW - one-line check
      markdown += `✓ All ${lowDeps.length} ${lowDeps.length === 1 ? 'dependency' : 'dependencies'} passed checks\n\n`;
    } else {
      // Some MEDIUM/HIGH - show LOW in collapsed section
      markdown += `<details>
<summary>✓ ${lowDeps.length} LOW risk ${lowDeps.length === 1 ? 'dependency' : 'dependencies'}</summary>

| Package | Version | File |
|---------|---------|------|
`;

      for (const dep of lowDeps) {
        markdown += `| \`${dep.packageName}\` | \`${dep.version}\` | \`${dep.file}\` |\n`;
      }

      markdown += `
</details>

`;
    }
  }

  markdown += `---
<sub>👻 [ghostdeps](https://github.com/jasonzli-DEV/ghostdeps) · [add to your repo](https://github.com/jasonzli-DEV/ghostdeps#install) · [false positive?](https://github.com/jasonzli-DEV/ghostdeps/issues/new) · If ghostdeps caught something useful, consider [⭐ starring the repo](https://github.com/jasonzli-DEV/ghostdeps) — it helps others find it.</sub>`;

  return markdown;
}

export async function upsertPRComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  scoredDeps: ScoredDependency[],
  sha: string,
  postComment: boolean
): Promise<void> {
  if (!postComment) {
    return;
  }

  try {
    // Find existing comment
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber
    });

    const existingComment = comments.find((comment: any) =>
      comment.body?.includes(COMMENT_MARKER)
    );

    const markdown = generateReportMarkdown(scoredDeps, sha);

    // If zero new deps and no existing comment, post nothing
    if (scoredDeps.length === 0 && !existingComment) {
      return;
    }

    if (existingComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body: markdown
      });
    } else {
      // Create new comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body: markdown
      });
    }
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 403) {
      core.warning('pull-requests:write permission not available - skipping PR comment');
      return;
    }
    throw error;
  }
}
