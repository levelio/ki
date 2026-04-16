# Changelog

## 0.4.0

### Minor Changes

- 145aacb: Add installation reconciliation and restore commands, including `ki reconcile`, `ki repair`, and `ki restore` for managing drift between `installed.json` and real target state.

  Add bulk source operations with `ki source install <name>` and `ki source uninstall <name>` so users can install or remove all skills from a source across one or more targets.

  Improve source management and platform compatibility by adding CLI support for source option updates, safer non-interactive install behavior, and platform-aware config, cache, and installed index paths.

## 0.3.0

### Minor Changes

- 61a2b2b: Refine non-interactive CLI behavior and expand source management commands.

  - add structured source configuration commands: `ki source set`, `ki source unset`, and `ki source show`
  - allow source option management through CLI flags such as `--branch`, `--skills-path`, `--structure`, and `--skill-file`
  - switch install interaction to explicit `-i/--interactive` mode and remove `-y/--yes`
  - tighten non-interactive install and uninstall flows so they require exact, reproducible inputs

## 0.2.0

### Minor Changes

- Migrate the CLI from Bun to Node/npm, switch builds to tsup and tests to Vitest, and tighten project-scoped install, update, and uninstall behavior. This release also adds Changesets-based release automation and refreshes the bundled `ki-usage` skill and README docs to match the current CLI.

## 0.1.5

### Patch Changes

- ce947b1: Read the CLI version from `package.json` instead of a hardcoded constant, and make `--help` and `--version` output use the same `ki` branding.

All notable changes to this project will be documented in this file.
