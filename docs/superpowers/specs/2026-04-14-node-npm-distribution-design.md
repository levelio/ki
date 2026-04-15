# Node and npm Distribution Design

## Goal

Move `ki` from a Bun-based CLI and binary release workflow to a Node.js 20+ CLI distributed through npm, with tag-triggered npm publishing and Vitest-based testing.

## Scope

This design covers:

- replacing Bun runtime dependencies in the CLI implementation
- replacing Bun-based development, build, and test scripts
- publishing the package to npm on pushed `v*` tags
- version/tag consistency enforcement
- README updates for npm-based installation and Node-based development

This design does not cover:

- GitHub Release binary artifacts
- standalone install scripts for end users
- package manager integrations beyond npm
- multi-channel publishing such as prerelease or next tags

## Current State

- the CLI entrypoint is a TypeScript file executed with Bun
- Git operations use `Bun.spawn`
- tests use Bun's built-in test runner
- the release workflow builds binary artifacts for multiple OS targets
- README still documents Bun development and binary-style distribution

## Problems

1. Bun is a hard runtime dependency for both local development and npm installation.
2. Binary release distribution is not the desired long-term path.
3. Cross-platform compatibility is harder to guarantee with the current mixed model.
4. npm installation is misleading because it still depends on Bun.

## Chosen Approach

Adopt a conventional Node package workflow:

- runtime baseline: Node.js `>=20`
- package manager: `npm`
- build: `tsc`
- development runner: `tsx`
- testing: `vitest`
- publish target: npm
- publish trigger: pushed `v*` tag
- version contract: tag name without `v` must equal `package.json.version`

## Package Design

The npm package will expose:

- package name: keep current package identity unless explicitly changed later
- executable command: `ki`
- published entrypoint: compiled JavaScript in `dist/`

Expected package layout after build:

- `dist/cli.js`
- any additional compiled runtime modules required by the CLI

`package.json` will be updated so that:

- `bin.ki` points to `dist/cli.js`
- `engines.node` is `>=20`
- publish scripts use npm-native tooling

## Runtime Migration

The CLI implementation will stop relying on Bun-specific APIs.

Required code changes:

- replace `Bun.spawn` with Node child process APIs
- ensure the CLI can run as compiled ESM JavaScript under Node 20
- keep file-system and path behavior consistent across macOS, Linux, and Windows

The shebang will change from Bun-specific execution to Node execution.

## Testing Design

Testing will move to Vitest.

This includes:

- replacing Bun test imports with Vitest imports
- updating the test script to `vitest run`
- keeping tests local and deterministic

The new release-asset naming test added during the binary distribution work should be removed or rewritten only if still useful after the npm migration. Since binary assets are no longer part of the product contract, that test should be removed unless repurposed for npm publish validation.

## Build and Development Scripts

`package.json` scripts should become:

- `dev`: run the TypeScript CLI with `tsx`
- `build`: compile TypeScript to `dist/` with `tsc`
- `test`: run `vitest`

Binary build scripts and Bun-specific scripts should be removed.

## npm Publish Workflow

The GitHub Actions workflow should:

- trigger on pushed `v*` tags
- use Node 20
- run `npm ci`
- run `npm test`
- run `npm run build`
- verify tag/version consistency
- publish to npm using `NPM_TOKEN`

The workflow should fail if:

- the tag does not match `package.json.version`
- tests fail
- build fails
- npm publish fails

## Version Contract

Publishing requires:

- `package.json.version === github.ref_name` without the leading `v`

Examples:

- tag `v0.2.0` requires `package.json.version` to be `0.2.0`
- tag `v1.0.0-beta.1` requires `package.json.version` to be `1.0.0-beta.1`

No automatic version bumping or write-back should occur in CI.

## Documentation Design

README files must be updated to reflect the npm-first model:

- installation should recommend `npm install -g ki-skill`
- Bun-based install and development instructions should be removed
- binary release and `install.sh` instructions should be removed
- development prerequisites should state Node.js 20+ and npm

If `install.sh` is no longer part of the supported distribution path, it should be removed from the repository or clearly deprecated. Preferred direction: remove it to avoid split support paths.

## Error Handling

CLI runtime behavior should remain unchanged from the user's perspective wherever possible.

Migration-specific failures should be explicit:

- missing `git` executable should surface a normal subprocess error
- tag/version mismatch should produce a clear CI error
- unsupported Node versions should be rejected via `engines`

## Testing Strategy

Implementation should verify:

- `npm test` passes
- `npm run build` passes
- built CLI entrypoint exists in `dist/`
- package metadata points `bin` to the built entrypoint
- workflow references npm publishing rather than binary release packaging

Because npm publish cannot be exercised from local development here, local verification will stop at build, test, and workflow contract checks.

## Risks

- ESM path resolution can break after compiling to `dist/` if imports rely on Bun-specific behavior.
- Replacing `Bun.spawn` with Node child process APIs may subtly change stdout/stderr handling.
- Removing the binary workflow without fully updating docs could leave stale installation guidance.

## Mitigations

- keep the runtime migration minimal and focused
- verify subprocess error handling after the spawn migration
- update both README files in the same change set
- enforce tag/version matching in CI to prevent accidental bad publishes

## Implementation Outline

1. migrate runtime and test dependencies from Bun to Node/Vitest
2. update package scripts and package metadata for npm distribution
3. replace the binary release workflow with an npm publish workflow
4. remove binary-distribution-specific artifacts and tests that no longer apply
5. update README files to document npm installation and Node 20+ development
6. run local test/build verification and workflow contract checks
