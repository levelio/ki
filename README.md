[English](./README.en.md) | 简体中文

# ki

跨工具 Skill 管理器，帮助你在多个 AI 编码工具（Claude Code、Codex、Cursor 等）之间统一管理和同步技能。

适合这样的场景：

- 你希望把一套 skills 同时分发到多个 AI 编码工具
- 你希望用 Git 仓库统一管理团队或个人的 skill 来源
- 你希望查看当前安装状态、批量更新，并在出问题时快速自检

## 特性

- 🔌 **多源支持** - 支持 Git 仓库和本地目录作为技能源
- 🎯 **多目标安装** - 同时安装到多个 AI 工具
- 🔍 **交互式搜索** - 可搜索的多选界面
- 🔄 **自动更新** - 一键更新所有已安装技能
- 📁 **多目录支持** - 单个源可包含多个技能目录

## 安装

推荐把 `ki` 当作一个直接可执行的二进制工具来使用。默认安装方式是通过 `curl` 下载最新 release 并放到你的 PATH 中。

### 一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/levelio/ki/main/install.sh | bash
```

### 手动安装

从 [Releases](https://github.com/levelio/ki/releases) 下载对应平台的二进制文件：

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

### 从源码构建（开发用）

```bash
git clone https://github.com/levelio/ki.git
cd ki
bun install
bun run build
```

## 升级

重新运行安装脚本即可升级到最新版本：

```bash
curl -fsSL https://raw.githubusercontent.com/levelio/ki/main/install.sh | bash
```

## 快速开始

```bash
# 初始化配置
ki init

# 查看默认内置的源和目标
ki source list
ki target list

# 同步默认源
ki source sync

# 搜索并查看可用技能
ki search brainstorming
ki list

# 安装技能
ki install brainstorming

# 查看当前启用的源、目标和已安装情况
ki status

# 自检配置和安装状态
ki doctor
```

如果你已经知道精确的 skill id 和 target，可以直接非交互安装：

```bash
ki install superpowers:brainstorming -t codex -y
```

如果某个 skill 只想在当前仓库生效：

```bash
ki install superpowers:brainstorming -t codex --project -y
```

如果只想先看变更，不执行写入：

```bash
ki install superpowers:brainstorming -t codex --project --dry-run
ki update --dry-run
```

## 技能源管理工作流

```bash
# 添加一个 Git 源，并显式命名，便于后续 enable/disable/remove
ki source add https://github.com/acme/skills.git --name acme

# 也可以直接添加一个本地目录 source
ki source add ./skills --name local-skills

# 查看当前所有源
ki source list

# 只同步这个源
ki source sync acme

# 查看这个源里有哪些技能
ki source skills acme

# 临时停用这个源（保留配置）
ki source disable acme

# 重新启用这个源
ki source enable acme

# 不再使用时，先卸载这个源里已经安装的 skill，再移除 source
# 例如：
# ki uninstall acme:brainstorming -t codex --global -y
# ki uninstall acme:brainstorming -t codex --project -y
# ki doctor
ki source remove acme
```

注意：

- `ki source add` 可以自动识别 Git URL 和现有本地目录
- 添加本地目录时，路径必须已经存在，且是一个目录
- `ki source remove` 只删除 source 配置，不会自动卸载这个 source 已安装的 skill

## 命令参考

| 命令 | 说明 |
|------|------|
| `ki init` | 初始化配置文件 |
| `ki status` | 查看当前启用的源、目标和安装状态 |
| `ki doctor` | 检查配置和安装状态是否异常 |
| `ki search <query>` | 按名称或 ID 搜索技能 |
| `ki list` | 列出所有可用技能 |
| `ki install [search]` | 安装技能（支持搜索） |
| `ki uninstall [search]` | 卸载技能 |
| `ki update` | 更新所有已安装技能 |
| `ki source add <git-url-or-path> [--name <name>]` | 添加一个 Git 或本地目录技能源，可显式指定源名称 |
| `ki source remove <name>` | 删除一个技能源 |
| `ki source list` | 列出所有源 |
| `ki source sync [name]` | 同步源 |
| `ki source skills [name]` | 查看源中的技能 |
| `ki source enable <name>` | 启用一个技能源 |
| `ki source disable <name>` | 禁用一个技能源 |
| `ki target list` | 列出所有目标工具 |

## 配置

配置文件位于 `~/.config/ki/config.yaml`

### 完整配置示例

```yaml
sources:
  # Git 仓库
  - name: my-skills
    provider: git
    url: https://github.com/user/skills.git
    enabled: true

  # 多目录配置
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

  # 本地目录
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

`ki init` 默认会写入一组内置 source（当前包括 `superpowers` 和 `ki`）以及常用 target（`claude-code`、`codex`、`cursor`），通常不需要先手动添加 source 就可以开始使用。

在项目目录中，如果某个 skill 只想在当前仓库生效，可使用 `--project` 安装或更新；否则保持默认全局安装即可。

如果只想先看变更，不执行写入，可为 `install` 或 `update` 添加 `--dry-run`。

如果你要使用本地目录作为 source，可以直接运行 `ki source add /path/to/skills --name local-skills`；如果需要更细的 `options`，再手动编辑 `~/.config/ki/config.yaml`。

### Source 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 源名称，用于标识和引用 |
| `provider` | string | ✅ | 提供者类型：`git` 或 `local` |
| `url` | string | ✅ | Git 仓库 URL 或本地目录路径 |
| `enabled` | boolean | ✅ | 是否启用此源 |
| `options` | object | ❌ | 提供者特定选项 |

### Source Options 字段说明

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `skillsPath` | string \| string[] | 技能目录路径，支持数组形式指定多个目录 | `skills` |
| `structure` | string | 目录结构：`nested`（每技能一目录）或 `flat`（直接为文件） | `nested` |
| `skillFile` | string | 技能文件名（仅 nested 结构） | `SKILL.md` |
| `branch` | string | Git 分支名称 | `main` |

### Target 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 目标工具名称：`claude-code`、`codex`、`cursor` |
| `enabled` | boolean | ✅ | 是否启用此目标 |

## 技能目录结构

### nested（推荐）

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

## SKILL.md 格式

```markdown
---
name: 技能名称
description: 技能描述
---

# 技能标题

技能内容...
```

## 目录结构

```
~/.config/ki/
├── config.yaml      # 主配置
├── cache/           # Git 仓库缓存
└── installed.json   # 已安装记录
```

## 开发

```bash
# 安装依赖
bun install

# 运行开发版本
bun run dev

# 构建
bun run build        # 当前平台
bun run build:all    # 所有平台

# 测试
bun test
```

## License

MIT
