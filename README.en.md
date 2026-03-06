English | [简体中文](./README.md)

# ki

A cross-tool Skill Manager that helps you manage and sync skills across multiple AI coding tools (Claude Code, Cursor, etc).

## Features

- 🔌 **Multi-source Support** - Git repositories and local directories as skill sources
- 🎯 **Multi-target Installation** - Install to multiple AI tools simultaneously
- 🔍 **Interactive Search** - Searchable multi-select interface
- 🔄 **Auto Update** - One-click update for all installed skills
- 📁 **Multi-directory Support** - Single source can contain multiple skill directories

## Installation

```bash
# Using bun
bun install -g lazyskill

# Or build from source
git clone https://github.com/user/lazyskill.git
cd lazyskill
bun install
bun run build
```

## Quick Start

```bash
# Initialize config
ki init

# Sync skill sources
ki source sync

# List available skills
ki list

# Interactive install (searchable multi-select)
ki install

# Update all installed skills
ki update
```

## Command Reference

| Command | Description |
|---------|-------------|
| `ki init` | Initialize config file |
| `ki list` | List all available skills |
| `ki install [search]` | Install skills (supports search) |
| `ki uninstall [search]` | Uninstall skills |
| `ki update` | Update all installed skills |
| `ki source list` | List all sources |
| `ki source sync [name]` | Sync sources |
| `ki source skills [name]` | List skills in a source |
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
  - name: cursor
    enabled: true
```

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
| `name` | string | ✅ | Target tool name: `claude-code`, `cursor` |
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
