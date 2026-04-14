---
name: ki-usage
description: Use when working with ki CLI to manage skill sources, inspect available skills, install or uninstall skills, and diagnose config or install issues
---

# ki CLI 使用指南

本技能面向会直接调用命令的 Agent。

目标：让 Agent 优先通过 `ki` CLI 完成 source 管理、skill 安装/卸载、状态检查和诊断，而不是手动改配置文件。

## Agent 执行约定

- 优先使用 CLI，不要先改 `~/.config/ki/config.yaml`。
- 优先使用非交互命令，避免卡在 TUI。
- 需要精确安装或卸载时，显式传入 skill id、target 和 `-y`。
- 需要只作用于当前仓库时，显式传入 `--project`。
- 需要只看计划不写入时，使用 `--dry-run`。

## 命令入口

优先顺序如下：

```bash
# 1. 已全局安装 ki 时
ki --help

# 2. 在 ki 仓库内直接运行源码入口
bun run src/cli.ts --help

# 3. 已构建二进制时
./dist/ki --help
```

如果 Agent 已经在本仓库内工作，默认优先用：

```bash
bun run src/cli.ts
```

下面示例里的 `ki`，都可以等价替换为 `bun run src/cli.ts`。

## 最常用命令

| 命令 | 用途 |
|------|------|
| `ki init` | 初始化默认配置 |
| `ki status` | 查看当前 source、target 和安装状态 |
| `ki doctor` | 检查配置和安装记录问题，并给出修复建议 |
| `ki search <query>` | 搜索 skill |
| `ki list` | 列出可用 skill |
| `ki install <skill-id> -t <target> -y` | 非交互安装 |
| `ki uninstall <skill-id> -t <target> -y` | 非交互卸载 |
| `ki update` | 更新已安装 skill |
| `ki source add <git-url-or-path> --name <name>` | 添加 source |
| `ki source list` | 查看 source |
| `ki source sync [name]` | 同步 source |
| `ki source skills [name]` | 查看 source 中的 skill |
| `ki source enable <name>` | 启用 source |
| `ki source disable <name>` | 禁用 source |
| `ki source remove <name>` | 删除 source |
| `ki target list` | 查看支持的 target |

## 推荐工作流

### 1. 首次初始化

```bash
ki init
ki status
ki doctor
```

### 2. 添加并使用一个 source

```bash
ki source add https://github.com/acme/skills.git --name acme
ki source add ./skills --name local-skills
ki source list
ki source sync acme
ki source skills acme
ki search brainstorming
```

### 3. 非交互安装到指定目标

```bash
ki install acme:brainstorming -t codex -y
```

安装到当前项目：

```bash
ki install acme:brainstorming -t codex --project -y
```

预览但不写入：

```bash
ki install acme:brainstorming -t codex --project --dry-run
```

### 4. 非交互卸载

```bash
ki uninstall acme:brainstorming -t codex --global -y
```

卸载当前项目安装：

```bash
ki uninstall acme:brainstorming -t codex --project -y
```

### 5. source 生命周期管理

```bash
ki source disable acme
ki source enable acme

# 删除 source 前，先卸载该 source 已安装的 skill
# 例如：
# ki uninstall acme:brainstorming -t codex --global -y
# ki uninstall acme:brainstorming -t codex --project -y
# ki doctor
ki source remove acme
```

## Agent 标准操作模板

以下模板用于让 Agent 在常见任务里保持固定顺序。

### 模板 1：新增 source 并确认可用

适用：用户说“添加一个 skills 仓库”“接入一个 source”“把本地目录接进来”。

```bash
ki source add <git-url-or-path> --name <source-name>
ki source sync <source-name>
ki source skills <source-name>
```

### 模板 2：按关键词查找 skill

适用：用户只给模糊名字，没有给精确 skill id。

```bash
ki search <query>
```

如果结果仍不清楚，再补：

```bash
ki source skills <source-name>
ki list
```

### 模板 3：非交互安装到指定 target

适用：用户已经给出精确 skill id 和 target。

全局安装：

```bash
ki install <skill-id> -t <target> -y
```

项目安装：

```bash
ki install <skill-id> -t <target> --project -y
```

预览：

```bash
ki install <skill-id> -t <target> --project --dry-run
```

### 模板 4：非交互卸载

适用：用户要从某个 target 或某个作用域移除 skill。

全局卸载：

```bash
ki uninstall <skill-id> -t <target> --global -y
```

项目卸载：

```bash
ki uninstall <skill-id> -t <target> --project -y
```

### 模板 5：先诊断再修复

适用：用户说“不能用”“装了但没生效”“帮我修一下 ki 配置”。

```bash
ki doctor
```

然后：

- 优先执行 `doctor` 输出里的 `Fix:`
- 不要先手改 `config.yaml`
- 只有在 `doctor` 无法覆盖时，才人工检查配置和安装记录

### 模板 6：先看现状再操作

适用：用户上下文不足，Agent 需要先确认当前状态。

```bash
ki status
ki source list
ki target list
```

### 模板 7：更新并验证

适用：用户要求“更新技能”“同步最新 skill”。

先预览：

```bash
ki update --dry-run
```

再执行：

```bash
ki update
```

如果只处理当前仓库：

```bash
ki update --project
```

## Agent 决策规则

### 需要列出现状时

先用：

```bash
ki status
ki source list
ki target list
```

### 需要排查问题时

先用：

```bash
ki doctor
```

`doctor` 已经会输出 `Fix:` 建议。Agent 应优先执行这些建议，而不是自行猜测修复方式。

### 需要安装 skill 时

- 如果用户给了精确 skill id 和 target，直接非交互执行。
- 如果用户只给模糊关键字，先 `ki search <query>` 或 `ki list`，再决定是否安装。
- 如果用户没说明作用域，默认是全局安装；只在当前仓库使用时才加 `--project`。

### 需要改 source 时

- 添加：`ki source add <git-url-or-path> --name <name>`
- 暂停使用：`ki source disable <name>`
- 恢复使用：`ki source enable <name>`
- 删除：`ki source remove <name>`

除非用户明确要求，否则不要手动编辑配置文件来完成这些动作。

## 常见场景

### 查看某个 source 提供了哪些 skill

```bash
ki source sync acme
ki source skills acme
```

### 只看已安装 skill

```bash
ki list --installed
```

### 更新当前项目里的安装记录

```bash
ki update --project
```

### 预览更新

```bash
ki update --dry-run
```

## 常见错误与处理

| 问题 | 处理方式 |
|------|----------|
| `No skills available. Add sources first.` | 先 `ki source add <git-url-or-path> --name ...`，再 `ki source sync` |
| `Source not found or disabled` | 先 `ki source list`，必要时 `ki source enable <name>` |
| `No enabled targets` | 先 `ki target list`，然后检查配置里的 target 是否被禁用 |
| 安装记录漂移或目录缺失 | 先 `ki doctor`，按输出的 `Fix:` 执行 |

## 配置文件位置

```text
~/.config/ki/
├── config.yaml
├── cache/
└── installed.json
```

只有在用户明确要求“直接修改配置”时，Agent 才应编辑这些文件。
