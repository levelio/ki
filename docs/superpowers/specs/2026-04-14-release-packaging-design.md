# Release Packaging Design

## Goal

Make `ki` publish stable cross-platform binaries through GitHub Releases when a `v*` tag is pushed, with release assets and installation instructions aligned across workflow, install script, and README.

## Scope

This design covers:

- GitHub Actions release flow triggered by `v*` tags
- Release asset packaging format and naming
- Checksum generation and publication
- `install.sh` download and install behavior
- README updates to match release artifacts

This design does not cover:

- PR or branch build validation workflows
- Package manager integrations such as Homebrew, Scoop, winget, or npm-first distribution
- Code signing or notarization

## Current State

- The repository already has a tag-triggered release workflow.
- The workflow builds four platform binaries and uploads raw executables to GitHub Releases.
- `install.sh` downloads raw binaries directly from release assets.
- README currently documents raw binary downloads.
- npm distribution still depends on Bun and is not the primary release path.

## Problems

1. Raw binaries are functional but not ideal as public release artifacts.
2. Release assets do not include a checksum file for integrity verification.
3. The install script and README are coupled to the raw-binary layout.
4. The project wants a more standard open source CLI release shape for macOS, Linux, and Windows users.

## Chosen Approach

Use packaged release archives plus a checksum manifest:

- macOS and Linux assets are published as `.tar.gz`
- Windows assets are published as `.zip`
- a `SHA256SUMS` file is generated in the release job and attached to the release
- releases are created only from pushed `v*` tags

This keeps the current release trigger model while improving artifact ergonomics and verification.

## Release Asset Layout

Each GitHub Release will contain:

- `ki-darwin-arm64.tar.gz`
- `ki-darwin-x64.tar.gz`
- `ki-linux-x64.tar.gz`
- `ki-windows-x64.zip`
- `SHA256SUMS`

Each archive contains:

- the platform binary named `ki` on Unix platforms
- the platform binary named `ki.exe` on Windows

If a repository-level `LICENSE` file is later added, it may be included in archives without changing the external release contract.

## Workflow Design

The release workflow remains tag-triggered:

- trigger: `push.tags: ['v*']`
- build matrix: `linux-x64`, `darwin-arm64`, `darwin-x64`, `windows-x64`

Per-platform build job responsibilities:

1. check out the repository
2. install Bun
3. install dependencies
4. compile the platform binary
5. stage the binary in a packaging directory with the correct final filename
6. create the archive format for that platform
7. upload the archive as a workflow artifact

Release job responsibilities:

1. download all packaged artifacts
2. generate `SHA256SUMS` from the final archives
3. create a GitHub Release for the pushed tag
4. attach all archives and `SHA256SUMS`

## Naming Rules

External release asset names are stable and platform-oriented:

- `ki-darwin-arm64.tar.gz`
- `ki-darwin-x64.tar.gz`
- `ki-linux-x64.tar.gz`
- `ki-windows-x64.zip`

Internal binary names are installation-oriented:

- Unix archives contain `ki`
- Windows archives contain `ki.exe`

This avoids forcing users to rename downloaded binaries manually after extraction.

## Install Script Design

`install.sh` will be updated to:

1. detect OS and architecture
2. resolve the matching archive filename for the current platform
3. download the archive from the GitHub Release
4. download `SHA256SUMS`
5. verify the downloaded archive checksum when `shasum -a 256` or `sha256sum` is available
6. extract the binary into a temporary directory
7. install the extracted binary to the target install directory

Verification behavior:

- checksum verification is enforced when a supported checksum tool exists
- if no checksum tool exists, the script warns and continues

Extraction behavior:

- Unix archives are extracted with `tar`
- Windows zip assets remain part of the release contract, but the shell installer only needs to support Unix-like environments because the script itself is Bash-based

## README Design

README files must reflect the release contract exactly:

- manual install examples should refer to the packaged archive assets, not raw binaries
- install guidance should make the install script the recommended path
- release file names should match the workflow outputs exactly
- npm installation remains documented separately and clearly framed as Bun-dependent

## Error Handling

Workflow:

- fail the build job if compilation or packaging fails
- fail the release job if checksum generation or asset upload fails

Install script:

- fail with a clear message for unsupported OS or architecture
- fail if release asset download fails
- fail if checksum verification fails
- fail if extraction does not produce the expected binary

## Testing Strategy

Implementation should validate:

- local packaging commands produce the expected file names
- the workflow YAML references the same names as the install script and README
- the install script chooses the right archive name for macOS arm64, macOS x64, and Linux x64
- checksum verification logic works when checksum tooling is available

Because GitHub Actions cannot be executed fully from local development, verification will rely on:

- local script inspection and shell execution where possible
- local build command execution for at least one platform target
- YAML diff review against expected asset names

## Risks

- Bun cross-compilation behavior may differ slightly across runner environments.
- Windows packaging must preserve a clean `ki.exe` file name inside the archive.
- Asset naming drift between workflow, installer, and README would break downloads.

## Mitigations

- define asset names once and reuse them consistently in the workflow
- keep archive file names simple and predictable
- verify installer logic against the same naming table used in the workflow
- update both Chinese and English README files in the same change set

## Implementation Outline

1. update the release workflow to package archives instead of uploading raw binaries
2. generate and upload `SHA256SUMS` in the release job
3. update `install.sh` to download, verify, and extract archives
4. update `README.md` and `README.en.md` to match the new release assets
5. run local verification for build and installer logic
