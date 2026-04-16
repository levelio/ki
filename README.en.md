English | [简体中文](./README.md)

<p align="center">
  <img src="./assets/ki-logo.jpg" alt="ki logo" width="260" />
</p>

<h1 align="center">ki</h1>

<p align="center">
  A cross-tool Skill Manager that helps you manage and sync skills across multiple AI coding tools.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ki-skill"><img src="https://img.shields.io/npm/v/ki-skill?logo=npm&color=CB3837" alt="npm version" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white" alt="node >= 20" />
  <a href="https://github.com/levelio/ki/actions/workflows/changeset-check.yml"><img src="https://img.shields.io/github/actions/workflow/status/levelio/ki/changeset-check.yml?branch=main&label=checks" alt="checks" /></a>
  <img src="https://img.shields.io/badge/license-MIT-0E8A16" alt="MIT license" />
  <img src="https://img.shields.io/badge/targets-Claude%20Code%20%7C%20Codex%20%7C%20Cursor-748E49" alt="targets" />
</p>

## Features

- 🔌 Multi-source support for Git repositories and local directories
- 🎯 Multi-target installation across AI tools
- 🔍 Interactive search and multi-select install flow
- 🔄 Update installed skills
- 🩺 Reconcile drift, repair the installed index, and restore global installs
- 📁 Multiple skill directories per source
- ⚙️ Configure source `branch`, `skillsPath`, `structure`, and `skillFile` through the CLI

## Requirements

- Node.js 20+
- npm

## Platform Support

- macOS: supported
- Linux: supported
- Windows: experimental support

The current Windows work focuses on platform-aware config/cache directories and safer target installation behavior, but it has not yet been fully validated in a real Windows environment.

## Installation

```bash
npm install -g ki-skill
```

Then run:

```bash
ki --help
```

## Quick Start

```bash
# Initialize config
ki init

# Sync the built-in ki source from this repository
ki source sync ki

# Inspect the skills shipped by this repository
ki source skills ki

# Install the ki-usage skill from this repository
ki install ki:ki-usage -t claude-code

# List all available skills
ki list
```

## Install This Repository's Skill

After `ki init`, the default config already includes the `ki` Git source for this repository, so users do not need to add it manually:

```yaml
sources:
  - name: ki
    provider: git
    url: https://github.com/levelio/ki.git
    enabled: true
```

Recommended flow for installing `ki-usage`:

```bash
ki init
ki source sync ki
ki source skills ki
ki install ki:ki-usage -t claude-code
```

To install the same skill into multiple target tools:

```bash
ki install ki:ki-usage -t claude-code,cursor
```

## Usage Examples

Once installed, ask the target AI tool to use the skill for `ki`-related tasks. Example prompts:

```text
Use the ki-usage skill to add a Git source for me: https://github.com/acme/product-skills.git, and name it acme-skills.
```

```text
Use the ki-usage skill to show me which skills are available in the acme-skills source.
```

```text
Use the ki-usage skill to install the acme-skills:prd-review skill into claude-code.
```

By default, the CLI does not enter interactive mode automatically. If you already know the exact skill id and target, run the install directly:

```bash
ki install superpowers:brainstorming -t codex
```

If the skill should only apply to the current repository:

```bash
ki install superpowers:brainstorming -t codex --project
```

If you want to preview changes without writing:

```bash
ki install superpowers:brainstorming -t codex --project --dry-run
ki update --dry-run
ki repair --dry-run
```

If you want to explicitly enter the TUI flow:

```bash
ki install -i
ki install brainstorming -i
```

`-y/--yes` has been removed. For install and uninstall, provide exact non-interactive arguments directly; only `-i/--interactive` enters the install TUI.

## Source Management Workflow

```bash
# Add a Git source with an explicit name so enable/disable/remove stay predictable
ki source add https://github.com/acme/skills.git --name acme

# If you already know the repository layout, you can configure source options at add time
ki source add https://github.com/acme/product-skills.git \
  --name acme \
  --branch main \
  --skills-path packages/agent/skills \
  --structure nested \
  --skill-file SKILL.md

# You can also add an existing local directory as a source
ki source add ./skills --name local-skills

# Show all configured sources
ki source list

# Sync just this source
ki source sync acme

# Inspect the skills provided by this source
ki source skills acme

# Install every skill from this source into the specified targets
ki source install acme -t codex,cursor

# Uninstall all installed skills from this source for the specified target
ki source uninstall acme -t codex --global

# Show the source config, effective values, and resolved paths
ki source show acme

# Update source options
ki source set acme --skills-path skills/.curated,skills/.system

# Explicitly enable or disable a source with set
ki source set acme --disable
ki source set acme --enable

# Remove option overrides and fall back to provider defaults
ki source unset acme --branch --skills-path

# Disable the source without removing its config
ki source disable acme

# Re-enable it later
ki source enable acme

# When you no longer need a source, uninstall any skills from it first, then remove it
# For example:
# ki uninstall acme:brainstorming -t codex --global
# ki uninstall acme:brainstorming -t codex --project
# ki doctor
ki source remove acme
```

Notes:

- `ki source add` can auto-detect Git URLs and existing local directories
- `ki source add` and `ki source set` can configure `branch`, `skillsPath`, `structure`, and `skillFile`
- `ki source add --disabled` creates a source in the disabled state, and `ki source set --enable/--disable` toggles it later
- when adding a local source, the path must already exist and be a directory
- `ki source install <name> -t <targets>` installs every skill from a source into the specified targets
- `ki source uninstall <name> -t <targets>` uninstalls installed skills from a source for the specified targets
- `ki source remove` removes source config only; it does not uninstall skills that were installed from that source

## Installed Index Maintenance

`ki` now treats the target filesystem as the real installation state, and the installed index file as a verifiable ledger.

Default locations:

- Linux: `${XDG_CONFIG_HOME:-~/.config}/ki/installed.json`
- macOS: `~/.config/ki/installed.json`
- Windows: `%APPDATA%\\ki\\installed.json`

Common commands:

```bash
# Read-only reconciliation between installed.json and target state
ki reconcile

# Repair only installed.json entries that no longer exist in targets
ki repair

# Preview which installed index entries repair would remove
ki repair --dry-run

# Restore global installs using installed.json + config.yaml
ki restore

# Restore only one source's global installs
ki restore --source superpowers
```

Behavior boundaries:

- `ki reconcile` is read-only
- `ki repair` updates `installed.json` only; it does not reinstall missing skills and does not remove untracked target artifacts
- `ki restore` currently restores `global` installs only; it does not remap project paths across machines

## Command Reference

| Command | Description |
|---------|-------------|
| `ki init` | Initialize config file |
| `ki status` | Show enabled sources, targets, and install status |
| `ki doctor` | Check config and install health |
| `ki reconcile` | Reconcile `installed.json` against actual target state |
| `ki repair` | Repair drifted entries in `installed.json` only |
| `ki search <query>` | Search skills by name or id |
| `ki list` | List all available skills |
| `ki install [search]` | In non-interactive mode, requires an exact skill id; when multiple targets are enabled, also requires `-t/--target`; pass `-i/--interactive` to enter the TUI |
| `ki uninstall [search]` | In non-interactive mode, requires an exact skill id; in most cases also requires `-t/--target` plus `--global` or `--project`; no implicit interaction |
| `ki restore` | Restore global installs using `installed.json` and the current source config |
| `ki update` | Update all installed skills |
| `ki source add <git-url-or-path> [flags]` | Add a Git or local source and optionally set source options at the same time |
| `ki source set <name> [flags]` | Update an existing source's options or enabled state |
| `ki source unset <name> [flags]` | Remove source option overrides and fall back to defaults |
| `ki source show <name>` | Show a source's config, effective values, and resolved paths |
| `ki source remove <name>` | Remove a skill source |
| `ki source list` | List all sources |
| `ki source sync [name]` | Sync sources |
| `ki source skills [name]` | List skills in a source |
| `ki source install <name>` | Install all skills from a source |
| `ki source uninstall <name>` | Uninstall installed skills from a source |
| `ki source enable <name>` | Enable a skill source |
| `ki source disable <name>` | Disable a skill source |
| `ki target list` | List all target tools |

## Configuration

Config file locations:

- Linux: `${XDG_CONFIG_HOME:-~/.config}/ki/config.yaml`
- macOS: `~/.config/ki/config.yaml`
- Windows: `%APPDATA%\\ki\\config.yaml`

In common cases, prefer the CLI for source management:

```bash
ki source add <git-url-or-path> --name <name> [--branch ...] [--skills-path ...] [--structure ...] [--skill-file ...]
ki source set <name> [--branch ...] [--skills-path ...] [--structure ...] [--skill-file ...]
ki source unset <name> [--branch] [--skills-path] [--structure] [--skill-file]
ki source show <name>
```

Inspect or edit `config.yaml` directly only when you need the full raw config or behavior that the CLI does not cover.

```yaml
sources:
  - name: superpowers
    provider: git
    url: https://github.com/obra/superpowers.git
    enabled: true

  - name: ki
    provider: git
    url: https://github.com/levelio/ki.git
    enabled: true

  - name: local-skills
    provider: local
    url: /path/to/your-skills-repo
    options:
      skillsPath: skills
      structure: nested
      skillFile: SKILL.md
    enabled: false

targets:
  - name: claude-code
    enabled: true
  - name: codex
    enabled: true
  - name: cursor
    enabled: true
```

Example: configure a Git source whose skills live in a deep subdirectory

```bash
ki source add https://github.com/acme/product-skills.git \
  --name acme \
  --branch main \
  --skills-path packages/agent/skills \
  --structure nested \
  --skill-file SKILL.md

ki source sync acme
ki source skills acme
```

Example: switch a source to multiple skill directories

```bash
ki source set acme --skills-path skills/.curated,skills/.system
ki source show acme
```

Example: add a source in the disabled state, then enable it later

```bash
ki source add https://github.com/acme/product-skills.git --name acme --disabled
ki source show acme
ki source set acme --enable
```

## Development

```bash
npm install
npm run check
npm run verify
npm run format
npm run dev
npm test
npm run build
npm run changeset
```

`npm install` also installs local Git hooks automatically:

- `pre-commit` runs `npm run check`
- `pre-push` runs `npm run verify`

## Publishing

The package is released through Changesets release PRs and published to npm after the release PR is merged.

Release contract:

- user-visible changes should run `npm run changeset`
- the workflow runs `npm ci`, `npm run check`, `npm test`, and `npm run build`
- the publish job uses npm trusted publishing with GitHub OIDC instead of a long-lived `NPM_TOKEN`
- the Changesets action creates or updates the release PR
- merging the release PR runs `npm publish`
- npm must be configured to trust `.github/workflows/release.yml` as a publisher for this package

## Project Scope Notes

- `ki install --project`, `ki update --project`, and `ki uninstall --project` all use the current working directory as the project root, so run them from the target repository.

## License

MIT
