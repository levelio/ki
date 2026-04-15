# Node and npm Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Bun-based CLI and binary release flow with a Node.js 20+ CLI published to npm via tag-triggered GitHub Actions.

**Architecture:** Migrate runtime execution to compiled Node ESM, replace Bun-only APIs and tests, switch local scripts to npm plus `tsx`/`tsc`/`vitest`, and replace the binary release workflow with an npm publish workflow that enforces tag/version consistency.

**Tech Stack:** Node.js 20+, npm, TypeScript, tsx, Vitest, GitHub Actions

---

### Task 1: Migrate tests from Bun to Vitest

**Files:**
- Modify: `src/release-assets.test.ts`
- Modify: `package.json`
- Create: `vitest.config.ts` if needed

- [ ] **Step 1: Write the failing test**

Keep the existing release asset naming assertions, but change the imports to Vitest:

```ts
import { describe, expect, it } from 'vitest'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/release-assets.test.ts`
Expected: FAIL because Vitest is not installed and the project is still configured for Bun.

- [ ] **Step 3: Write minimal implementation**

Update `package.json` dev dependencies and scripts so Vitest is available:

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^2",
    "tsx": "^4"
  }
}
```

Update the test file to use `it` from Vitest.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand`
Expected: PASS for the migrated test file.

### Task 2: Remove Bun runtime coupling from the CLI

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/providers/git.ts`

- [ ] **Step 1: Write the failing test**

Use the existing test suite plus a build check as the contract. Add a focused runtime test only if the spawn migration needs one.

- [ ] **Step 2: Run checks to show current Node incompatibility**

Run: `rg -n "Bun\\.spawn|#!/usr/bin/env bun" src/cli.ts src/providers/git.ts`
Expected: FINDINGS showing Bun-specific runtime hooks still exist.

- [ ] **Step 3: Write minimal implementation**

Replace Bun-specific pieces:

```ts
#!/usr/bin/env node
```

and replace `Bun.spawn` with Node child process handling:

```ts
import { spawn } from 'node:child_process'
```

Use a Promise wrapper that captures stdout, stderr, and exit code.

- [ ] **Step 4: Run checks to verify Bun runtime hooks are removed**

Run: `rg -n "Bun\\.spawn|#!/usr/bin/env bun" src/cli.ts src/providers/git.ts`
Expected: no matches

### Task 3: Convert package metadata and scripts to npm + Node 20

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Delete: `bun.lock`

- [ ] **Step 1: Write the failing test**

Use package contract checks via grep and build output verification.

- [ ] **Step 2: Run checks to show current package contract is wrong**

Run: `rg -n "\"bin\"|\"scripts\"|@types/bun|bun run|bun build|bun test|\"engines\"" package.json`
Expected: FINDINGS showing Bun-based scripts and missing Node engine contract.

- [ ] **Step 3: Write minimal implementation**

Update `package.json` so that:

```json
{
  "type": "module",
  "bin": {
    "ki": "./dist/cli.js"
  },
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  }
}
```

Ensure TypeScript emits into `dist/`.

- [ ] **Step 4: Run package contract checks**

Run: `rg -n "\"ki\": \"\\./dist/cli.js\"|\"node\": \">=20\"|tsx src/cli.ts|tsc -p tsconfig.json|vitest run" package.json`
Expected: PASS

### Task 4: Replace binary release workflow with npm publish workflow

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Write the failing test**

Use grep-based workflow contract checks for npm publishing and tag/version enforcement.

- [ ] **Step 2: Run checks to show the current workflow is still binary-oriented**

Run: `rg -n "setup-bun|bun install|bun build|action-gh-release|npm publish|NPM_TOKEN|package.json.version" .github/workflows/release.yml`
Expected: FINDINGS for Bun and binary-release steps, and no npm publish flow.

- [ ] **Step 3: Write minimal implementation**

Replace the workflow with a tag-triggered npm publish flow using Node 20:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    registry-url: https://registry.npmjs.org

- run: npm ci
- run: npm test
- run: npm run build
- name: Verify tag matches package version
  run: |
    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    TAG_VERSION="${GITHUB_REF_NAME#v}"
    test "$PACKAGE_VERSION" = "$TAG_VERSION"
- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 4: Run workflow contract checks**

Run: `rg -n "setup-node|npm ci|npm test|npm run build|npm publish|NPM_TOKEN|GITHUB_REF_NAME#v" .github/workflows/release.yml`
Expected: PASS

### Task 5: Remove binary distribution artifacts and update docs

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Delete: `install.sh`

- [ ] **Step 1: Write the failing test**

Use grep-based doc checks for stale Bun and binary-install guidance.

- [ ] **Step 2: Run checks to show current docs are stale**

Run: `rg -n "bun |install.sh|tar.gz|zip|SHA256SUMS|raw.githubusercontent.com/.*/install.sh" README.md README.en.md`
Expected: FINDINGS for Bun and binary-install references.

- [ ] **Step 3: Write minimal implementation**

Update both README files so that they:

- recommend `npm install -g ki-skill`
- state Node.js 20+ and npm as prerequisites
- document `npm install`, `npm run dev`, `npm run build`, and `npm test` for development
- remove binary release and install script instructions

Remove `install.sh` from the repository.

- [ ] **Step 4: Run doc checks to verify cleanup**

Run: `rg -n "npm install -g ki-skill|Node.js 20|npm run dev|npm run build|npm test" README.md README.en.md`
Expected: PASS

### Task 6: Final verification

**Files:**
- Modify: `package.json`
- Modify: `src/cli.ts`
- Modify: `src/providers/git.ts`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`
- Modify: `README.en.md`
- Delete: `install.sh`

- [ ] **Step 1: Install dependencies**

Run: `npm install`
Expected: PASS and generate `package-lock.json`

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS and create `dist/cli.js`

- [ ] **Step 4: Run final contract checks**

Run: `rg -n "Bun\\.|#!/usr/bin/env bun|bun run|bun build|bun test|setup-bun|action-gh-release|install.sh" src package.json README.md README.en.md .github/workflows/release.yml`
Expected: no matches for active Bun/binary distribution paths

- [ ] **Step 5: Run npm publish contract checks**

Run: `rg -n "\"ki\": \"\\./dist/cli.js\"|\"node\": \">=20\"|vitest run|npm publish|NODE_AUTH_TOKEN|GITHUB_REF_NAME#v" package.json .github/workflows/release.yml`
Expected: PASS
