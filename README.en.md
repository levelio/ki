English | [简体中文](./README.md)

# ki

A cross-tool Skill Manager that helps you manage and sync skills across multiple AI coding tools such as Claude Code and Cursor.

## Features

- 🔌 Multi-source support for Git repositories and local directories
- 🎯 Multi-target installation across AI tools
- 🔍 Interactive search and multi-select install flow
- 🔄 Update installed skills
- 📁 Multiple skill directories per source

## Requirements

- Node.js 20+
- npm

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
ki install ki:ki-usage -t claude-code -y

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
ki install ki:ki-usage -t claude-code -y
```

To install the same skill into multiple target tools:

```bash
ki install ki:ki-usage -t claude-code,cursor -y
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

If you already know the exact skill id and target, use a non-interactive install:

```bash
ki install superpowers:brainstorming -t codex -y
```

If the skill should only apply to the current repository:

```bash
ki install superpowers:brainstorming -t codex --project -y
```

If you want to preview changes without writing:

```bash
ki install superpowers:brainstorming -t codex --project --dry-run
ki update --dry-run
```

## Source Management Workflow

```bash
# Add a Git source with an explicit name so enable/disable/remove stay predictable
ki source add https://github.com/acme/skills.git --name acme

# You can also add an existing local directory as a source
ki source add ./skills --name local-skills

# Show all configured sources
ki source list

# Sync just this source
ki source sync acme

# Inspect the skills provided by this source
ki source skills acme

# Disable the source without removing its config
ki source disable acme

# Re-enable it later
ki source enable acme

# When you no longer need a source, uninstall any skills from it first, then remove it
# For example:
# ki uninstall acme:brainstorming -t codex --global -y
# ki uninstall acme:brainstorming -t codex --project -y
# ki doctor
ki source remove acme
```

Notes:

- `ki source add` can auto-detect Git URLs and existing local directories
- when adding a local source, the path must already exist and be a directory
- `ki source remove` removes source config only; it does not uninstall skills that were installed from that source

## Command Reference

| Command | Description |
|---------|-------------|
| `ki init` | Initialize config file |
| `ki status` | Show enabled sources, targets, and install status |
| `ki doctor` | Check config and install health |
| `ki search <query>` | Search skills by name or id |
| `ki list` | List all available skills |
| `ki install [search]` | Install skills |
| `ki uninstall [search]` | Uninstall skills |
| `ki update` | Update all installed skills |
| `ki source add <git-url-or-path> [--name <name>]` | Add a Git or local-directory skill source with an optional explicit source name |
| `ki source remove <name>` | Remove a skill source |
| `ki source list` | List all sources |
| `ki source sync [name]` | Sync sources |
| `ki source skills [name]` | List skills in a source |
| `ki source enable <name>` | Enable a skill source |
| `ki source disable <name>` | Disable a skill source |
| `ki target list` | List all target tools |

## Configuration

Config file location: `~/.config/ki/config.yaml`

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

## Development

```bash
npm install
npm run check
npm run format
npm run dev
npm test
npm run build
npm run changeset
```

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
