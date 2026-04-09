# GitHub CI/CD Design

## Overview

Set up GitHub Actions to build, package, and release the WebPull Chrome extension.

## Trigger Conditions

| Event | Behavior |
|-------|----------|
| `push` to `main` | Build verification only |
| `push` tag `v*` | Build + package + create GitHub Release |
| `workflow_dispatch` (manual) | Build + package (no release) |

## Jobs

### 1. Build Job (all triggers)

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
- run: npm ci
- run: npm run build
- uses: actions/upload-artifact@v4
  with:
    name: web-pull-dist
    path: dist/
    retention-days: 1
```

### 2. Package Job (tag + manual)

```yaml
- uses: actions/download-artifact@v4
  with:
    name: web-pull-dist
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
- run: npm run fix-paths
- run: wxt zip
- uses: actions/upload-artifact@v4
  with:
    name: web-pull-zip
    path: dist/web-pull-*.zip
    retention-days: 30
```

### 3. Release Job (tag only)

```yaml
- uses: actions/download-artifact@v4
  with:
    name: web-pull-dist
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
- run: npm run fix-paths
- run: wxt zip
- uses: softprops/action-gh-release@v2
  with:
    files: dist/web-pull-*.zip
    generate_release_notes: true
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Workflow File

`.github/workflows/release.yml`

## Secrets

No additional secrets required.
