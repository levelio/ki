English | [简体中文](./README.md)

# ki

A cross-tool Skill Manager that helps you manage and sync skills across multiple AI coding tools (Claude Code, Codex, Cursor, etc).

It is designed for workflows like:

- distributing the same skill set to multiple AI coding tools
- managing team or personal skills from Git repositories
- checking install state, updating in bulk, and diagnosing broken setups quickly

## Features

- 🔌 **Multi-source Support** - Supports both Git repositories and local directories as skill sources
- 🎯 **Multi-target Installation** - Install to multiple AI tools simultaneously
- 🔍 **Interactive Search** - Searchable multi-select interface
- 🔄 **Auto Update** - One-click update for all installed skills
- 📁 **Multi-directory Support** - Single source can contain multiple skill directories

## Installation

`ki` is intended to be used as a directly executable binary. The default install path is a one-line `curl` installer that downloads the latest release binary and puts it on your PATH.

### One-line Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/levelio/ki/main/install.sh | bash
```

### Manual Install

Download the binary for your platform from [Releases](https://github.com/levelio/ki/releases):

```bash
# macOS (ARM)
curl -L https://github.com/levelio/ki/releases/latest/download/ki-darwin-arm64 -o ki
chmod +x ki
sudo mv ki /usr/local/bin/

# macOS (Intel)
curl -L https://github.com/levelio/ki/releases/latest/download/ki-darwin-x64 -o ki
chmod +x ki
sudo mv ki /usr/local/bin/

# Linux
curl -L https://github.com/levelio/ki/releases/latest/download/ki-linux-x64 -o ki
chmod +x ki
sudo mv ki /usr/local/bin/
```

### Build from Source (for development)

```bash
git clone https://github.com/levelio/ki.git
cd ki
bun install
bun run build
```

## Upgrading

Run the install script again to upgrade to the latest version:

```bash
curl -fsSL https://raw.githubusercontent.com/levelio/ki/main/install.sh | bash
```

## Quick Start

```bash
# Initialize config
ki init

# Inspect the built-in default sources and targets
ki source list
ki target list

# Sync the default sources
ki source sync

# Search and inspect available skills
ki search brainstorming
ki list

# Install a skill
ki install brainstorming

# Show enabled sources, targets, and installed skills
ki status

# Check config and installed skill health
ki doctor
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
| `ki install [search]` | Install skills (supports search) |
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

Config file located at `~/.config/ki/config.yaml`

### Full Configuration Example

```yaml
sources:
  # Git repository
  - name: my-skills
    provider: git
    url: https://github.com/user/skills.git
    enabled: true

  # Multi-directory config
  - name: multi-skills
    provider: git
    url: https://github.com/org/skills.git
    options:
      skillsPath:
        - skills/.curated
        - skills/.system
      structure: nested
      skillFile: SKILL.md
      branch: main
    enabled: true

  # Local directory
  - name: local-skills
    provider: local
    url: /path/to/skills
    enabled: true

targets:
  - name: claude-code
    enabled: true
  - name: codex
    enabled: true
  - name: cursor
    enabled: true
```

`ki init` writes a default set of built-in sources (currently `superpowers` and `ki`) plus common targets (`claude-code`, `codex`, `cursor`), so you can usually get started without adding a source first.

When you only want a skill inside the current repository, use `--project` for install or update. Otherwise, keep the default global install path.

When you want to preview changes without writing anything, add `--dry-run` to `install` or `update`.

If you want to use a local directory as a source, you can run `ki source add /path/to/skills --name local-skills`; edit `~/.config/ki/config.yaml` directly only when you need more detailed `options`.

### Source Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Source name for identification and reference |
| `provider` | string | ✅ | Provider type: `git` or `local` |
| `url` | string | ✅ | Git repository URL or local directory path |
| `enabled` | boolean | ✅ | Whether this source is enabled |
| `options` | object | ❌ | Provider-specific options |

### Source Options Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `skillsPath` | string \| string[] | Path to skills directory, supports array for multiple directories | `skills` |
| `structure` | string | Directory structure: `nested` (one directory per skill) or `flat` (direct files) | `nested` |
| `skillFile` | string | Skill file name (nested structure only) | `SKILL.md` |
| `branch` | string | Git branch name | `main` |

### Target Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Target tool name: `claude-code`, `codex`, `cursor` |
| `enabled` | boolean | ✅ | Whether this target is enabled |

## Skill Directory Structure

### nested (recommended)

```
skills/
├── brainstorming/
│   └── SKILL.md
└── debugging/
    └── SKILL.md
```

### flat

```
skills/
├── brainstorming.md
└── debugging.md
```

## SKILL.md Format

```markdown
---
name: Skill Name
description: Skill description
---

# Skill Title

Skill content...
```

## Directory Structure

```
~/.config/ki/
├── config.yaml      # Main config
├── cache/           # Git repository cache
└── installed.json   # Installed records
```

## Development

```bash
# Install dependencies
bun install

# Run dev version
bun run dev

# Build
bun run build        # Current platform
bun run build:all    # All platforms

# Test
bun test
```

## License

MIT
