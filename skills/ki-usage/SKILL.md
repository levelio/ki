---
name: ki-usage
description: Use when working with ki CLI tool for skill management - installing, listing, syncing skills from git repositories, or configuring sources and targets
---

# ki CLI 使用指南

ki 是一个跨工具的 Skill 管理器，帮助用户在多个 AI 编码工具（Claude Code、Cursor 等）之间统一管理和同步技能。

**核心原则：** Git 仓库作为技能源 + 多目标工具安装 = 统一的技能管理

## 快速参考

| 命令 | 用途 |
|------|------|
| `ki init` | 初始化配置文件 |
| `ki list` | 列出所有技能 |
| `ki install [search]` | 安装技能（可搜索多选） |
| `ki uninstall [search]` | 卸载技能 |
| `ki update` | 更新所有已安装技能 |
| `ki source sync [name]` | 同步源 |
| `ki source skills [name]` | 查看源中技能 |

## 常用工作流

### 首次使用

```bash
ki init                    # 创建默认配置
ki source sync ki          # 同步本仓库内置的 ki 源
ki source skills ki        # 查看本仓库自带技能
ki install ki:ki-usage -t claude-code -y
ki list                    # 查看所有可用技能
```

### 安装本仓库自带 skill

`ki init` 生成的默认配置已经内置了当前仓库的 `ki` Git 源：

```yaml
sources:
  - name: ki
    provider: git
    url: https://github.com/levelio/ki.git
    enabled: true
```

推荐安装流程：

```bash
ki init
ki source sync ki
ki source skills ki
ki install ki:ki-usage -t claude-code -y
```

如果需要安装到多个目标工具：

```bash
ki install ki:ki-usage -t claude-code,cursor -y
```

### 添加其他技能源

编辑 `~/.config/ki/config.yaml`：

```yaml
sources:
  - name: my-skills
    provider: git
    url: https://github.com/user/skills.git
    enabled: true
```

然后：

```bash
ki source sync my-skills
ki source skills my-skills
ki install my-skills:skill-name
```

### 安装后如何使用

安装完成后，可以在目标 AI 工具中明确要求使用 `ki-usage` skill 来处理 `ki` 相关问题，例如：

```text
使用 ki-usage skill，帮我检查当前 ki 配置并列出所有 source。
```

```text
使用 ki-usage skill，告诉我如何把 ki 源里的 skill 安装到 claude-code。
```

```text
使用 ki-usage skill，帮我排查 ki source sync 后为什么还是看不到技能。
```

### 多目录源配置

```yaml
sources:
  - name: multi-dir-skills
    provider: git
    url: https://github.com/org/skills.git
    options:
      skillsPath:           # 支持数组
        - skills/.curated
        - skills/.system
      structure: nested
      skillFile: SKILL.md
    enabled: true
```

## 配置文件位置

```
~/.config/ki/
├── config.yaml      # 主配置
├── cache/           # Git 仓库缓存
└── installed.json   # 已安装记录
```

## 源配置选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `skillsPath` | 技能目录路径，支持数组 | `skills` |
| `structure` | `nested`（每技能一目录）或 `flat` | `nested` |
| `skillFile` | 技能文件名 | `SKILL.md` |
| `branch` | Git 分支 | `main` |

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

## 安装选项

```bash
ki install                          # 交互式多选
ki install brainstorming            # 搜索后多选
ki install superpowers:brainstorming -t claude-code -y  # 非交互式安装
ki install -t claude-code,cursor    # 指定目标
```

### 非交互式安装

使用 `-y/--yes` 参数跳过交互式确认。稳定路径是同时指定 skill ID 和目标：

```bash
ki install superpowers:brainstorming -t claude-code -y
```

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 技能列表为空 | 源未同步 | `ki source sync` |
| 找不到源 | 配置错误 | 检查 `~/.config/ki/config.yaml` |
| 安装失败 | 目标名称无效或目标工具不可用 | 检查 `targets` 配置和目标工具环境 |
| Git 同步失败 | 网络或权限问题 | 检查 URL 和访问权限 |

## 当前限制

- `ki install --project` 会写入项目目录，但后续 `ki update` / `ki uninstall` 还没有完整保留项目作用域，当前更推荐全局安装。

## SKILL.md 格式

```markdown
---
name: 技能名称
description: 技能描述
---

# 技能标题

技能内容...
```
