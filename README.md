[English](./README.en.md) | 简体中文

# ki

跨工具 Skill 管理器，帮助你在多个 AI 编码工具（Claude Code、Cursor 等）之间统一管理和同步技能。

## 特性

- 🔌 **多源支持** - Git 仓库、本地目录作为技能源
- 🎯 **多目标安装** - 同时安装到多个 AI 工具
- 🔍 **交互式搜索** - 可搜索的多选界面
- 🔄 **自动更新** - 一键更新所有已安装技能
- 📁 **多目录支持** - 单个源可包含多个技能目录

## 安装

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

### 从源码构建

```bash
git clone https://github.com/levelio/ki.git
cd ki
bun install
bun run build
```

### npm 安装

```bash
npm install -g ki-skill
# 或
bun install -g ki-skill
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

# 同步技能源
ki source sync

# 查看可用技能
ki list

# 交互式安装（可搜索多选）
ki install

# 更新所有已安装技能
ki update
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `ki init` | 初始化配置文件 |
| `ki list` | 列出所有可用技能 |
| `ki install [search]` | 安装技能（支持搜索） |
| `ki uninstall [search]` | 卸载技能 |
| `ki update` | 更新所有已安装技能 |
| `ki source list` | 列出所有源 |
| `ki source sync [name]` | 同步源 |
| `ki source skills [name]` | 查看源中的技能 |
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
  - name: cursor
    enabled: true
```

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
| `name` | string | ✅ | 目标工具名称：`claude-code`、`cursor` |
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
