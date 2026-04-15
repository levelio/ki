# Changesets Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual tag-first npm publishing with a mainstream Changesets release PR workflow for the `ki` package.

**Architecture:** Add Changesets config and scripts to the single-package repo, create the baseline changelog files, replace the publish workflow with the Changesets GitHub Action, remove obsolete tag-version enforcement, and document the contributor flow for creating changesets.

**Tech Stack:** Node.js 20+, npm, Changesets, GitHub Actions

---

### Task 1: Establish the missing Changesets baseline

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Run the missing command**

Run: `npm run changeset -- --help`
Expected: FAIL because the script and dependency do not exist yet.

### Task 2: Add Changesets package scripts and config

**Files:**
- Modify: `package.json`
- Create: `.changeset/config.json`
- Create: `.changeset/README.md`
- Create: `CHANGELOG.md`

- [ ] **Step 1: Add dependency and scripts**

Update `package.json` with:

```json
"scripts": {
  "changeset": "changeset",
  "version-packages": "changeset version",
  "release": "changeset publish"
}
```

and add `@changesets/cli` to `devDependencies`.

- [ ] **Step 2: Add baseline config**

Create `.changeset/config.json` for a single-package npm repo with changelog generation enabled and no fixed/linked package groups.

- [ ] **Step 3: Add baseline docs**

Create:

- `.changeset/README.md`
- `CHANGELOG.md`

with minimal starter content.

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: PASS and update `package-lock.json`.

### Task 3: Replace tag-first release workflow

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Replace workflow structure**

Remove tag-first publishing logic and use a Changesets workflow that runs on pushes to the default branch.

- [ ] **Step 2: Add standard checks**

Ensure workflow runs:

- `npm ci`
- `npm run check`
- `npm test`
- `npm run build`

- [ ] **Step 3: Add Changesets action**

Use the official Changesets action to:

- open/update a release PR when changesets exist
- publish to npm when release changes are ready

- [ ] **Step 4: Verify workflow contract**

Run: `rg -n "changesets/action|npm ci|npm run check|npm test|npm run build|NPM_TOKEN" .github/workflows/release.yml`
Expected: PASS

### Task 4: Remove obsolete tag-version enforcement

**Files:**
- Modify: `package.json`
- Delete: `scripts/check-tag-version.mjs`
- Delete: `src/release-tag.ts`
- Delete: `src/release-tag.test.ts`

- [ ] **Step 1: Remove scripts and code**

Delete the custom tag/version enforcement path because Changesets release PRs replace it.

- [ ] **Step 2: Verify cleanup**

Run: `rg -n "check:tag|release-tag" package.json scripts src`
Expected: no matches

### Task 5: Update contributor and release docs

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Document the new flow**

Update README files to explain:

- installation remains `npm install -g ki-skill`
- releases are managed by Changesets release PRs
- contributors run `npm run changeset` for user-visible changes

- [ ] **Step 2: Verify docs**

Run: `rg -n "npm run changeset|Changesets|release PR" README.md README.en.md`
Expected: PASS

### Task 6: Final verification

**Files:**
- Modify: `package.json`
- Create: `.changeset/config.json`
- Create: `.changeset/README.md`
- Create: `CHANGELOG.md`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Verify scripts**

Run: `npm run changeset -- --help`
Expected: PASS

- [ ] **Step 2: Run repository checks**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS
