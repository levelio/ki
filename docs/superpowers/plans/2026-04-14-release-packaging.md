# Release Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship tag-triggered GitHub Releases as packaged cross-platform archives with checksums, and keep the installer and README aligned with those assets.

**Architecture:** Keep the existing tag-only release trigger, but change each matrix build from uploading raw binaries to uploading packaged archives. Add checksum publication in the release job, update the shell installer to fetch and verify the new assets, and update both README files to document the packaged release contract.

**Tech Stack:** GitHub Actions, Bun compile, Bash installer, Markdown docs

---

### Task 1: Add regression coverage for release asset naming

**Files:**
- Create: `src/release-assets.ts`
- Create: `src/release-assets.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'bun:test'
import {
  getArchiveAssetName,
  getArchiveBinaryName,
  getInstallScriptAssetName,
} from './release-assets'

describe('release asset naming', () => {
  test('returns tar.gz assets and ki binary for unix targets', () => {
    expect(getArchiveAssetName('darwin-arm64')).toBe('ki-darwin-arm64.tar.gz')
    expect(getArchiveAssetName('darwin-x64')).toBe('ki-darwin-x64.tar.gz')
    expect(getArchiveAssetName('linux-x64')).toBe('ki-linux-x64.tar.gz')
    expect(getArchiveBinaryName('darwin-arm64')).toBe('ki')
    expect(getArchiveBinaryName('linux-x64')).toBe('ki')
  })

  test('returns zip asset and exe binary for windows target', () => {
    expect(getArchiveAssetName('windows-x64')).toBe('ki-windows-x64.zip')
    expect(getArchiveBinaryName('windows-x64')).toBe('ki.exe')
  })

  test('maps installer platform inputs to release asset names', () => {
    expect(getInstallScriptAssetName('darwin', 'arm64')).toBe('ki-darwin-arm64.tar.gz')
    expect(getInstallScriptAssetName('darwin', 'x64')).toBe('ki-darwin-x64.tar.gz')
    expect(getInstallScriptAssetName('linux', 'x64')).toBe('ki-linux-x64.tar.gz')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/release-assets.test.ts`
Expected: FAIL because `src/release-assets.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
const ARCHIVE_NAMES = {
  'darwin-arm64': 'ki-darwin-arm64.tar.gz',
  'darwin-x64': 'ki-darwin-x64.tar.gz',
  'linux-x64': 'ki-linux-x64.tar.gz',
  'windows-x64': 'ki-windows-x64.zip',
} as const

export type ReleaseTarget = keyof typeof ARCHIVE_NAMES

export function getArchiveAssetName(target: ReleaseTarget): string {
  return ARCHIVE_NAMES[target]
}

export function getArchiveBinaryName(target: ReleaseTarget): string {
  return target === 'windows-x64' ? 'ki.exe' : 'ki'
}

export function getInstallScriptAssetName(os: 'darwin' | 'linux', arch: 'arm64' | 'x64'): string {
  return getArchiveAssetName(`${os}-${arch}` as ReleaseTarget)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/release-assets.test.ts`
Expected: PASS

### Task 2: Package archives in the release workflow

**Files:**
- Modify: `.github/workflows/release.yml`
- Reference: `src/release-assets.ts`

- [ ] **Step 1: Write the failing test**

Use the Task 1 tests as the naming contract for the workflow changes. No new test file is needed for this task.

- [ ] **Step 2: Run test to verify current behavior is incomplete**

Run: `rg -n "ki-darwin-arm64|ki-linux-x64|ki-windows-x64.exe|SHA256SUMS|tar -czf|Compress-Archive" .github/workflows/release.yml`
Expected: raw binary names exist, but archive packaging and checksum generation are missing or incomplete.

- [ ] **Step 3: Write minimal implementation**

Update `.github/workflows/release.yml` so that:

```yaml
strategy:
  matrix:
    include:
      - os: ubuntu-latest
        target: linux-x64
        binary_name: ki
        archive_name: ki-linux-x64.tar.gz
      - os: macos-latest
        target: darwin-arm64
        binary_name: ki
        archive_name: ki-darwin-arm64.tar.gz
      - os: macos-13
        target: darwin-x64
        binary_name: ki
        archive_name: ki-darwin-x64.tar.gz
      - os: windows-latest
        target: windows-x64
        binary_name: ki.exe
        archive_name: ki-windows-x64.zip
```

and add platform-specific packaging steps:

```yaml
- name: Package Unix archive
  if: runner.os != 'Windows'
  run: |
    mkdir -p package
    mv build/${{ matrix.binary_name }} package/${{ matrix.binary_name }}
    tar -czf ${{ matrix.archive_name }} -C package ${{ matrix.binary_name }}

- name: Package Windows archive
  if: runner.os == 'Windows'
  shell: pwsh
  run: |
    New-Item -ItemType Directory -Force -Path package | Out-Null
    Move-Item "build/${{ matrix.binary_name }}" "package/${{ matrix.binary_name }}"
    Compress-Archive -Path "package/${{ matrix.binary_name }}" -DestinationPath "${{ matrix.archive_name }}"
```

Then generate checksums in the release job:

```yaml
- name: Generate SHA256SUMS
  run: |
    cd dist
    shasum -a 256 ki-darwin-arm64.tar.gz ki-darwin-x64.tar.gz ki-linux-x64.tar.gz ki-windows-x64.zip > SHA256SUMS
```

- [ ] **Step 4: Run contract check**

Run: `rg -n "archive_name|SHA256SUMS|tar -czf|Compress-Archive" .github/workflows/release.yml`
Expected: PASS, all packaged release concepts present.

### Task 3: Update the installer for packaged assets

**Files:**
- Modify: `install.sh`
- Reference: `src/release-assets.ts`

- [ ] **Step 1: Write the failing test**

Use the Task 1 tests as the asset mapping contract. Add one shell-level smoke check by grepping the installer for the new archive names only after implementation.

- [ ] **Step 2: Run test to verify current behavior is wrong for packaged releases**

Run: `rg -n "ki-darwin-arm64|ki-darwin-x64|ki-linux-x64|ki-windows-x64.exe|tar|zip|SHA256SUMS|shasum|sha256sum" install.sh`
Expected: raw binary download logic exists, archive extraction and checksum verification are missing.

- [ ] **Step 3: Write minimal implementation**

Update `install.sh` so that it:

```bash
case "$os/$arch" in
  darwin/arm64) archive_name="ki-darwin-arm64.tar.gz"; binary_name="ki" ;;
  darwin/x64) archive_name="ki-darwin-x64.tar.gz"; binary_name="ki" ;;
  linux/x64) archive_name="ki-linux-x64.tar.gz"; binary_name="ki" ;;
  windows/x64) archive_name="ki-windows-x64.zip"; binary_name="ki.exe" ;;
  *) error "Unsupported platform: $os/$arch" ;;
esac
```

download and verify:

```bash
archive_url="https://github.com/${REPO}/releases/download/${version}/${archive_name}"
checksums_url="https://github.com/${REPO}/releases/download/${version}/SHA256SUMS"
```

and add helpers to:

- detect `shasum -a 256` or `sha256sum`
- verify the downloaded archive against `SHA256SUMS`
- extract `.tar.gz` via `tar -xzf`
- extract `.zip` via `unzip` when needed
- install the extracted `ki` or `ki.exe`
```

- [ ] **Step 4: Run the installer contract checks**

Run: `rg -n "archive_name|SHA256SUMS|shasum|sha256sum|tar -xzf|unzip" install.sh`
Expected: PASS, installer now targets packaged assets and includes extraction plus checksum logic.

### Task 4: Align the README files

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Write the failing test**

Use grep-based doc contract checks so the README must mention archive assets, not raw binaries.

- [ ] **Step 2: Run doc checks to show current mismatch**

Run: `rg -n "ki-darwin-arm64$|ki-darwin-x64$|ki-linux-x64$|ki-windows-x64.exe$|tar.gz|zip|SHA256SUMS" README.md README.en.md`
Expected: FAIL to show missing packaged archive references or stale raw-binary examples.

- [ ] **Step 3: Write minimal implementation**

Update both README files so that:

- manual install examples download `.tar.gz` archives for Unix platforms
- Windows manual download references the `.zip` asset
- release download tables list the packaged asset names
- install guidance keeps the install script as the recommended path

- [ ] **Step 4: Run doc checks to verify alignment**

Run: `rg -n "ki-darwin-arm64.tar.gz|ki-darwin-x64.tar.gz|ki-linux-x64.tar.gz|ki-windows-x64.zip|SHA256SUMS" README.md README.en.md`
Expected: PASS

### Task 5: Final verification

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `install.sh`
- Modify: `README.md`
- Modify: `README.en.md`
- Create: `src/release-assets.ts`
- Create: `src/release-assets.test.ts`

- [ ] **Step 1: Run targeted tests**

Run: `bun test src/release-assets.test.ts`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `bun test`
Expected: PASS with the new tests included.

- [ ] **Step 3: Run build verification**

Run: `bun run build`
Expected: PASS and produce a local binary build for the current platform.

- [ ] **Step 4: Run contract checks**

Run: `rg -n "ki-darwin-arm64.tar.gz|ki-darwin-x64.tar.gz|ki-linux-x64.tar.gz|ki-windows-x64.zip|SHA256SUMS" .github/workflows/release.yml install.sh README.md README.en.md`
Expected: PASS, all release-facing surfaces agree on the same asset set.
