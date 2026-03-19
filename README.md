# 👻 ghostdeps

Catches hallucinated and suspicious dependencies introduced by AI coding assistants, on every PR.

## Install

Add to your repository in 4 lines:

```yaml
# .github/workflows/ghostdeps.yml
name: ghostdeps
on:
  pull_request:
    types: [opened, synchronize, reopened]

concurrency:
  group: ghostdeps-${{ github.ref }}-${{ github.sha }}
  cancel-in-progress: true

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      checks: write
    steps:
      - uses: jasonzli-DEV/ghostdeps@v1
```

That's it. No token configuration needed. No extra inputs required.

## What It Checks

ghostdeps scans every PR for suspicious dependencies across all major ecosystems:

- **Known AI Hallucinations** — Packages that LLMs commonly invent (e.g., `react-codeshift`, `python-datutil`, `openai-utils`)
- **Typosquats** — Packages 1-2 characters away from popular packages (e.g., `lodahs` instead of `lodash`)
- **Newly Registered** — Packages created in the last 7-30 days
- **Low Download Velocity** — New packages with suspiciously few downloads
- **Cross-Ecosystem Confusion** — Package names that exist in multiple ecosystems with different purposes

## Supported Ecosystems

| Ecosystem | File(s) | Status |
|-----------|---------|--------|
| npm / JavaScript | `package.json` | ✅ |
| Python | `requirements.txt`, `pyproject.toml`, `Pipfile` | ✅ |
| Ruby | `Gemfile` | ✅ |
| Go | `go.mod` | ✅ |
| Rust | `Cargo.toml` | ✅ |
| PHP | `composer.json` | ✅ |
| .NET | `.csproj`, `packages.config` | ✅ |

## Configuration

All inputs are optional. Defaults are safe and non-blocking.

```yaml
- uses: jasonzli-DEV/ghostdeps@v1
  with:
    # Fail the check if risk level meets threshold
    # Options: high | medium | low
    # Default: "" (warn only, never block)
    fail-on: ""

    # Post PR comment summary
    # Default: true
    post-comment: "true"

    # Ecosystems to scan (comma-separated)
    # Default: all
    ecosystems: "all"

    # GitHub token
    # Default: ${{ github.token }}
    token: ${{ github.token }}
```

## Experience

### Check Run Annotations

ghostdeps creates inline annotations on dependency files:

```
⚠️ ghostdeps: HIGH risk dependency
Known AI hallucination: 'react-codeshift'
```

- **HIGH** findings: Red warnings
- **MEDIUM** findings: Yellow notices
- **LOW** findings: Not annotated (shown in comment only)

### PR Comment

Every scan updates a single pinned comment:

```markdown
## 👻 ghostdeps

Scanned 5 new dependencies · Last scanned: a1b2c3d · 2m ago

### ⚠️ 2 HIGH risk dependencies detected

| Risk | Package | Version | File | Details |
|------|---------|---------|------|---------|
| 🔴 HIGH | `react-codeshift` | `1.0.0` | `package.json` | Known AI hallucination: 'react-codeshift' |
| 🔴 HIGH | `lodahs` | `4.17.21` | `package.json` | 1 character from 'lodash' — possible typosquat |

<details>
<summary>✓ 3 LOW risk dependencies</summary>

| Package | Version | File |
|---------|---------|------|
| `axios` | `^1.4.0` | `package.json` |
| `express` | `^4.18.2` | `package.json` |
| `react` | `^18.2.0` | `package.json` |

</details>
```

## Behavior

- **Non-blocking by default** — Check status is always "neutral" (grey circle) unless `fail-on` is set
- **Single comment** — Updates the same comment on every push; never creates duplicates
- **Zero noise** — If no new dependencies are added, nothing is posted
- **All-clear state** — If previously flagged dependencies are removed, shows "✓ No new dependencies"
- **Graceful degradation** — If permissions are missing, logs a clear warning and continues

## FAQ

### Will this break my CI?

No. By default, ghostdeps always completes with a "neutral" status (grey circle). It never blocks merges unless you explicitly set `fail-on: high|medium|low`.

### What if I get a false positive?

Open an issue: [Report false positive](https://github.com/jasonzli-DEV/ghostdeps/issues/new)

If a legitimate package is incorrectly flagged, we'll remove it from the known-hallucinations list.

### Can I add my own hallucinated packages?

Yes. Submit a PR to [`data/known-hallucinations.json`](./data/known-hallucinations.json) with evidence (LLM chat logs, published research, etc.).

### Does this work with GHES?

Yes. ghostdeps automatically detects GitHub Enterprise Server via the `GITHUB_API_URL` environment variable.

### What permissions does this need?

Minimum:
- `contents: read` — Read PR diffs
- `pull-requests: write` — Post/update comments
- `checks: write` — Create check runs and annotations

If any permission is missing, ghostdeps logs a warning and gracefully skips that feature.

## Contributing

### Adding Known Hallucinations

Submit a PR to [`data/known-hallucinations.json`](./data/known-hallucinations.json). Include:

1. Package name(s)
2. Ecosystem
3. Evidence (LLM chat logs, published research, Twitter thread, etc.)

We prioritize packages with public documentation of hallucination incidents.

### Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build dist/
npm run build

# Lint
npm run lint
```

Before tagging a release:
1. Run `npm run build`
2. Commit the updated `dist/` directory
3. Tag with `v1`, `v1.x.x`, etc.

## Research & Credit

ghostdeps is based on published research into AI code hallucinations:

- Lanyado et al. (2024) — "Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection"
- Spracklen (2024) — "ChatGPT Package Hallucinations"
- Vu et al. (2023) — "Security Implications of Large Language Model Code Assistants"

## License

MIT — See [LICENSE](./LICENSE)

---

If ghostdeps caught something useful, consider [⭐ starring the repo](https://github.com/jasonzli-DEV/ghostdeps) — it helps others find it.
