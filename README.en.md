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

## Command Reference

| Command | Description |
|---------|-------------|
| `ki init` | Initialize config file |
| `ki list` | List all available skills |
| `ki install [search]` | Install skills |
| `ki uninstall [search]` | Uninstall skills |
| `ki update` | Update all installed skills |
| `ki source list` | List all sources |
| `ki source sync [name]` | Sync sources |
| `ki source skills [name]` | List skills in a source |
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
- the Changesets action creates or updates the release PR
- merging the release PR runs `npm publish`
- the repository must provide `NPM_TOKEN` in GitHub Actions secrets

## Current Limitations

- `ki install --project` can write into the project directory, but follow-up `ki update` and `ki uninstall` do not fully preserve project scope yet. Global installs are the stable path for now.

## License

MIT
