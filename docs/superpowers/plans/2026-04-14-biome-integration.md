# Biome Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Biome for repository-wide linting and formatting, expose npm scripts for local use, and enforce `biome check` in CI before tests and publish.

**Architecture:** Keep the integration minimal: add a root `biome.json`, wire `lint`, `format`, and `check` scripts in `package.json`, run `npm run check` in GitHub Actions, and update README development commands. Use Biome defaults unless current code requires a narrow compatibility override.

**Tech Stack:** Node.js 20+, npm, Biome, GitHub Actions

---

### Task 1: Establish a failing check baseline

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Run the missing command**

Run: `npm run check`
Expected: FAIL because the `check` script does not exist yet.

### Task 2: Add Biome config and npm scripts

**Files:**
- Create: `biome.json`
- Modify: `package.json`

- [ ] **Step 1: Add package scripts and dependency**

Add:

```json
"scripts": {
  "lint": "biome lint .",
  "format": "biome format --write .",
  "check": "biome check ."
}
```

and add `@biomejs/biome` to `devDependencies`.

- [ ] **Step 2: Add repository config**

Create a root `biome.json` that checks the whole repo, ignores `dist` and `node_modules`, and enables formatter plus linter with defaults.

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: PASS and update `package-lock.json`.

### Task 3: Enforce Biome in CI

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Add CI step**

Insert:

```yaml
- name: Run Biome checks
  run: npm run check
```

before test/build/publish steps.

- [ ] **Step 2: Verify workflow contract**

Run: `rg -n "npm run check" .github/workflows/release.yml`
Expected: PASS

### Task 4: Update docs

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Update development commands**

Add `npm run check` and `npm run format` to the development sections.

- [ ] **Step 2: Verify docs**

Run: `rg -n "npm run check|npm run format" README.md README.en.md`
Expected: PASS

### Task 5: Final verification

**Files:**
- Create: `biome.json`
- Modify: `package.json`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Run Biome**

Run: `npm run check`
Expected: PASS

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS
