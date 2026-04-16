---
name: ki-usage
description: Use when working with ki CLI to manage skill sources, inspect available skills, install or uninstall skills, and diagnose config or install issues
---

# ki CLI 使用指南

本技能面向会直接调用命令的 Agent。

目标：让 Agent 通过 `ki` CLI 完成 source 管理、source 配置、skill 安装/卸载、状态检查和诊断。对用户要求的 source 管理和安装任务，不允许用手动修改配置或手动复制文件来绕过 CLI。

## Agent 执行约定

- 优先使用 CLI，不要一上来就手动改 `~/.config/ki/config.yaml`。
- 默认使用非交互命令，避免卡在 TUI。
- 只有显式传入 `-i` 或 `--interactive` 时，才允许进入 TUI。
- 不要使用 `-y` 或 `--yes`；这两个参数已移除。
- 需要精确安装时，显式传入精确 skill id，必要时补 `-t` 和 `--project`。
- 需要精确卸载时，显式传入精确 skill id、target、作用域（`--global` 或 `--project`）。
- 需要只作用于当前仓库时，显式传入 `--project`。
- 需要只看计划不写入时，使用 `--dry-run`。
- 参数不够精确时，先查询，再执行安装或卸载；不要默认触发交互式选择。

## 严格禁止的替代做法

对下面这几类用户任务，Agent 不能用手工文件操作来模拟成功：

- 不能手动编辑 `~/.config/ki/config.yaml` 来代替 `ki source add`、`ki source set`、`ki source unset`、`ki source enable`、`ki source disable`、`ki source remove`。
- 不能手动编辑 `~/.config/ki/installed.json` 来代替 `ki install`、`ki uninstall`、`ki update`。
- 不能手动编辑 `~/.config/ki/installed.json` 来代替 `ki install`、`ki uninstall`、`ki update`、`ki repair`、`ki restore`。
- 不能直接把 skill 文件或目录复制、软链接到 target 目录，例如 `~/.claude/skills/`、`~/.agents/skills/`、`~/.cursor/skills/`，来代替 `ki install`。
- 不能在 CLI 安装失败后，靠手工改配置或手工复制文件把结果补出来，然后向用户报告安装成功。

允许手动查看这些文件做诊断，但诊断结束后，真正的修复动作仍应回到 `ki` CLI；如果 CLI 本身有 bug，应报告 bug 或修 CLI，而不是绕过 CLI 完成用户任务。

## 非交互优先原则

Agent 默认不要进入交互式选择界面。以下情况不要直接执行 `ki install` 或 `ki uninstall`，而要先补信息：

- 不知道精确 skill id，只知道模糊关键词。
- 不知道 target。
- 不知道安装/卸载作用域是 `global` 还是 `project`。
- 卸载时存在多个匹配安装记录。

推荐顺序：

1. 先用只读命令确认现状，例如 `ki status`、`ki target list`、`ki search <query>`、`ki source skills <name>`。
2. 拿到精确 `skill id`、`target`、`scope` 后，再执行非交互命令。
3. 只有用户明确要求交互式选择时，才允许在 `ki install` 上使用 `-i` 或 `--interactive`。

如果非交互命令失败：

1. 先保留失败现场和命令输出。
2. 再用 `ki status`、`ki doctor`、`ki source show <name>`、`ki source skills <name>` 继续诊断。
3. 如果确认是 `ki` 的实现 bug，应该修 `ki` 或明确向用户报告失败原因。
4. 不要通过手改配置或手动复制文件来伪造一个成功安装的最终状态。

明确避免以下写法：

```bash
ki install
ki install brainstorming
ki uninstall brainstorming
ki uninstall acme:brainstorming
```

这些写法在当前 CLI 里会因为条件不充分而失败，行为不稳定。

## 命令入口

优先顺序如下：

```bash
# 1. 已全局安装 ki 时
ki --help

# 2. 在 ki 仓库内直接运行源码入口
npm run dev -- --help

# 3. 已构建二进制时
node ./dist/cli.js --help
```

如果 Agent 已经在本仓库内工作，默认优先用：

```bash
npm run dev --
```

下面示例里的 `ki`，都可以等价替换为 `npm run dev --`。

## Agent 决策模板

把任务分成两类：

- 已知精确信息：直接执行非交互命令。
- 信息不完整：先查询，补齐参数，再执行。

示例：

- 用户说“安装 `ki:ki-usage` 到 `claude-code`”：
  直接执行 `ki install ki:ki-usage -t claude-code`
- 用户说“帮我装一个 brainstorming skill”：
  先执行 `ki search brainstorming`
- 用户说“把 acme 的 prd-review 从 codex 卸掉”但没说明作用域：
  先执行 `ki status`，必要时补充看安装记录，再用 `--global` 或 `--project` 精确卸载

## 最常用命令

| 命令 | 用途 |
|------|------|
| `ki init` | 初始化默认配置 |
| `ki status` | 查看当前 source、target 和安装状态 |
| `ki doctor` | 检查配置和安装记录问题，并给出修复建议 |
| `ki reconcile` | 对账 `installed.json` 和 target 实际状态 |
| `ki repair` | 只修复 `installed.json` 里的失真索引 |
| `ki search <query>` | 搜索 skill |
| `ki list` | 列出可用 skill |
| `ki install <skill-id> -t <target>` | 非交互安装 |
| `ki install [query] -i` | 显式进入安装 TUI |
| `ki uninstall <skill-id> -t <target> --global` | 非交互卸载全局安装 |
| `ki uninstall <skill-id> -t <target> --project` | 非交互卸载当前项目安装 |
| `ki restore` | 根据 `installed.json` 和 source 配置恢复全局安装 |
| `ki update` | 更新已安装 skill |
| `ki source add <git-url-or-path> [flags]` | 添加 source，并可同时设置 source options |
| `ki source set <name> [flags]` | 修改 source options 或启用状态 |
| `ki source unset <name> [flags]` | 清除 source option override，回退默认值 |
| `ki source show <name>` | 查看 source 配置、生效值和解析后的路径 |
| `ki source list` | 查看 source |
| `ki source sync [name]` | 同步 source |
| `ki source skills [name]` | 查看 source 中的 skill |
| `ki source install <name> -t <targets>` | 安装某个 source 下的全部技能 |
| `ki source uninstall <name> -t <targets>` | 卸载某个 source 下已安装的全部技能 |
| `ki source enable <name>` | 启用 source |
| `ki source disable <name>` | 禁用 source |
| `ki source remove <name>` | 删除 source |
| `ki target list` | 查看支持的 target |

## 推荐工作流

### 1. 首次初始化

```bash
ki init                    # 创建默认配置
ki source sync ki          # 同步本仓库内置的 ki 源
ki source skills ki        # 查看本仓库自带技能
ki install ki:ki-usage -t claude-code
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
ki install ki:ki-usage -t claude-code
```

如果需要安装到多个目标工具：

```bash
ki install ki:ki-usage -t claude-code,cursor
```

### 添加其他技能源

```bash
ki source add https://github.com/acme/skills.git --name acme
ki source add ./skills --name local-skills
ki source set acme --skills-path skills/.curated,skills/.system
ki source set acme --disable
ki source set acme --enable
ki source show acme
ki source list
ki source sync acme
ki source skills acme
ki source install acme -t codex,cursor
ki source uninstall acme -t codex --global
ki search brainstorming
```

### 3. 非交互安装到指定目标

```bash
ki install acme:brainstorming -t codex
```

安装到当前项目：

```bash
ki install acme:brainstorming -t codex --project
```

预览但不写入：

```bash
ki install acme:brainstorming -t codex --project --dry-run
```

### 4. 非交互卸载

```bash
ki uninstall acme:brainstorming -t codex --global
```

卸载当前项目安装：

```bash
ki uninstall acme:brainstorming -t codex --project
```

### 5. source 生命周期管理

```bash
ki source disable acme
ki source enable acme
ki reconcile
ki repair --dry-run
ki repair
ki restore
ki restore --source acme

# 删除 source 前，先卸载该 source 已安装的 skill
# 例如：
# ki uninstall acme:brainstorming -t codex --global
# ki uninstall acme:brainstorming -t codex --project
# ki doctor
ki source remove acme
```

说明：

- `ki reconcile` 只读，不写入任何文件。
- `ki repair` 只修复 `installed.json`，不会自动重装 skill，也不会自动删除 target 里的孤儿安装。
- `ki restore` 第一版只恢复 `global` 安装；如果用户要求跨机器恢复项目安装，不要自行假设路径映射，先说明限制。

## Agent 标准操作模板

以下模板用于让 Agent 在常见任务里保持固定顺序。

### 模板 1：新增 source 并确认可用

适用：用户说“添加一个 skills 仓库”“接入一个 source”“把本地目录接进来”。

```bash
ki source add <git-url-or-path> --name <source-name>
ki source sync <source-name>
ki source skills <source-name>
```

约束：

- 这三个步骤必须真的通过 `ki` CLI 执行完成。
- 如果 `ki source add` 或 `ki source sync` 失败，不要改写 `config.yaml` 来跳过它。

如果用户已经知道目录结构，可直接：

```bash
ki source add <git-url-or-path> --name <source-name> --skills-path <path> --structure nested
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

拿到精确 skill id 之前，不要直接执行 `ki install <query>`；先 `ki search <query>`，或在用户明确要求时使用 `ki install <query> -i`。

### 模板 3：非交互安装到指定 target

适用：用户已经给出精确 skill id 和 target。

全局安装：

```bash
ki install <skill-id> -t <target>
```

项目安装：

```bash
ki install <skill-id> -t <target> --project
```

预览：

```bash
ki install <skill-id> -t <target> --project --dry-run
```

约束：

- `skill-id` 必须是完整 id，例如 `ki:ki-usage`，不要只传关键词。
- 对 Agent 来说，`-t <target>` 最好显式给出，不要依赖默认 target 选择。
- 如果用户明确要求交互式选择，才使用 `ki install -i` 或 `ki install <query> -i`。
- 安装结果必须由 `ki install` 自己完成写入和落地；不要手工创建 target 目录内容。
- 安装后应用 `ki status`、`ki source skills <source-name>`、必要时再检查 target 目录，做只读验证。

### 模板 3A：安装某个 source 下的全部技能

适用：用户明确要求“把某个 source 的全部 skill 装到一个或多个 target”。

```bash
ki source install <source-name> -t <target-list>
```

项目安装：

```bash
ki source install <source-name> -t <target-list> --project
```

预览：

```bash
ki source install <source-name> -t <target-list> --project --dry-run
```

约束：

- `source-name` 必须是精确 source 名称。
- `-t <target-list>` 应显式给出，不要依赖默认 target 选择。
- 执行前先用 `ki source skills <source-name>` 确认该 source 下的 skill 列表。

### 模板 4：非交互卸载

适用：用户要从某个 target 或某个作用域移除 skill。

全局卸载：

```bash
ki uninstall <skill-id> -t <target> --global
```

项目卸载：

```bash
ki uninstall <skill-id> -t <target> --project
```

约束：

- 卸载时同时指定 `skill-id`、`-t <target>` 和作用域。
- 如果不确定作用域，先执行 `ki status`，不要直接卸载。
- 不要使用 `ki uninstall <query>` 这类模糊命令；多匹配时非交互会失败。

### 模板 4A：卸载某个 source 下的全部技能

适用：用户要把某个 source 当前已安装的 skill 按 target 批量移除。

全局卸载：

```bash
ki source uninstall <source-name> -t <target-list> --global
```

项目卸载：

```bash
ki source uninstall <source-name> -t <target-list> --project
```

约束：

- `source-name` 必须是精确 source 名称。
- `-t <target-list>` 应显式给出。
- 如果不确定当前有哪些安装记录，先执行 `ki status`。

### 模板 5：先诊断再修复

适用：用户说“不能用”“装了但没生效”“帮我修一下 ki 配置”。

```bash
ki doctor
```

然后：

- 优先执行 `doctor` 输出里的 `Fix:`
- 优先用 CLI 修复，例如 `ki source set`、`ki source unset`、`ki source enable`
- 可以人工检查配置和安装记录来诊断，但不要把手工编辑这些文件当成对用户任务的最终修复动作

### 模板 6：先看现状再操作

适用：用户上下文不足，Agent 需要先确认当前状态。

```bash
ki status
ki source list
ki target list
```

如果任务涉及卸载或“为什么没生效”，补充优先检查：

```bash
ki doctor
```

### 安装后如何使用

安装完成后，可以在目标 AI 工具中明确要求使用 `ki-usage` skill 来处理 `ki` 相关问题，例如：

```text
使用 ki-usage skill，帮我添加一个 Git 技能源，地址是 https://github.com/acme/product-skills.git，源名称叫 acme-skills。
```

```text
使用 ki-usage skill，帮我看一下 acme-skills 这个源中都有哪些技能。
```

```text
使用 ki-usage skill，帮我把 acme-skills 里的 prd-review 技能安装到 claude-code。
```

### 多目录源配置

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
- 修改：`ki source set <name> [flags]`
- 清理 override：`ki source unset <name> [flags]`
- 查看详情：`ki source show <name>`
- 暂停使用：`ki source disable <name>`
- 恢复使用：`ki source enable <name>`
- 删除：`ki source remove <name>`

优先用 CLI 完成这些动作；对于正常的 source 生命周期管理，不要回退到直接编辑 `~/.config/ki/config.yaml`。

启用状态也优先走 CLI：

- 创建时禁用：`ki source add <git-url-or-path> --name <name> --disabled`
- 后续禁用：`ki source set <name> --disable`
- 后续启用：`ki source set <name> --enable`

### 需要调整 source 配置时

以下情况，Agent 应明确检查并配置 source options，而不是只停留在 `ki source add`：

- Git 仓库里的 skill 目录不在根目录下的 `skills/`。
- 一个 source 里有多个 skill 目录。
- skill 不是“每个技能一个目录 + `SKILL.md`”的默认结构。
- skill 文件名不是默认的 `SKILL.md`。

推荐顺序分两种情况：

1. 已知目录结构：
   先 `ki source add <git-url-or-path> --name <name> ...flags...`；如果 source 已存在，则用 `ki source set <name> ...flags...`；然后执行 `ki source sync <name>` 和 `ki source skills <name>`。
2. 未知目录结构：
   先 `ki source add <git-url-or-path> --name <name>`，再执行 `ki source sync <name>`，检查 `~/.config/ki/cache/` 下的缓存仓库目录，确定 `options` 后优先用 `ki source set <name> ...flags...` 更新，然后重新执行 `ki source sync <name>` 和 `ki source skills <name>`。

不要只说“这个仓库没扫到 skill”。应先检查是不是 source 路径结构和默认值不一致。

### Git source 的目录分析方式

对 `provider: git` 的 source，Agent 不需要自己再把仓库 clone 到当前工作区。

应使用下面的顺序：

1. 先执行 `ki source add <git-url-or-path> --name <name>`。
2. 再执行 `ki source sync <name>`。
3. 然后检查 `~/.config/ki/cache/` 下该 source 的缓存仓库目录。
4. 基于缓存仓库的真实目录结构，判断应该设置的 `options.skillsPath`、`options.structure`、`options.skillFile`，必要时补 `options.branch`。
5. 优先用 `ki source set <name> ...flags...` 更新 source；不要把手动改 `~/.config/ki/config.yaml` 当成正常完成路径。
6. 再次执行 `ki source sync <name>` 和 `ki source skills <name>` 验证。

Agent 不要为了分析 skill 目录结构，额外把同一个 Git 仓库 clone 到业务项目目录里。

当前实现中，Git source 会被缓存到：

```text
~/.config/ki/cache/
```

这里的目录名由 source URL 推导而来，所以 Agent 应优先通过查看该目录下的缓存仓库来分析结构，而不是凭空猜测 `skillsPath`。

## 常见场景

### 查看某个 source 提供了哪些 skill

```bash
ki source sync acme
ki source skills acme
```

### 从 GitHub URL 接入并安装 skill

适用：用户给出一个 GitHub 仓库地址，希望接入为 source 并安装其中的 skill。

标准顺序：

```bash
ki source add <git-url> --name <source-name>
ki source sync <source-name>
ki source skills <source-name>
ki install <source-name>:<skill-name> -t <target>
ki status
```

约束：

- 先把 source 接入并验证可发现的 skill，再执行安装。
- 如果 `ki source skills <source-name>` 没看到目标 skill，先诊断 source options，不要直接复制 skill 文件到 target 目录。
- 如果 `ki install` 失败，先保留失败输出并继续诊断，不要改写 target 目录来伪造安装结果。

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
| `No skills available. Add sources first.` | 先 `ki source add <git-url-or-path> --name ...`，必要时 `ki source set ...`，再 `ki source sync` |
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

## 源配置选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `skillsPath` | 技能目录路径，支持数组 | `skills` |
| `structure` | `nested`（每技能一目录）或 `flat` | `nested` |
| `skillFile` | 技能文件名 | `SKILL.md` |
| `branch` | Git 分支 | `main` |

## 何时需要配置 source options

`ki source add` 和 `ki source set` 可以直接管理 source 的常见 options：`branch`、`skillsPath`、`structure`、`skillFile`。

所以遇到下面这些仓库结构时，Agent 应优先用 CLI 配置对应 option：

- skill 在深层目录，例如 `packages/agent/skills`
- skill 分散在多个目录
- 仓库使用 `flat` 结构
- skill 文件名不是 `SKILL.md`

## 用缓存仓库反推 source options

如果 `ki source sync <name>` 成功，但 `ki source skills <name>` 没有发现预期 skill，Agent 应进入“检查缓存仓库结构”的流程，而不是反复重试同一个命令。

推荐步骤：

1. 先确认 source 已经同步成功：`ki source sync <name>`
2. 查看 `~/.config/ki/cache/` 下的缓存仓库目录
3. 在缓存仓库里定位真实 skill 根目录
4. 判断它属于哪种结构：
   - `nested`：每个 skill 一个目录，目录下有 `SKILL.md`
   - `flat`：目录下直接是多个 `*.md`
5. 优先用 `ki source set <name> ...flags...` 写回 source options
6. 再执行 `ki source sync <name>` 和 `ki source skills <name>`

判断示例：

- 如果缓存仓库里是 `packages/agent/skills/review/SKILL.md`，则通常应设置：
  `skillsPath: packages/agent/skills`、`structure: nested`
- 如果缓存仓库里是 `skills/review.md`、`skills/debugging.md`，则通常应设置：
  `skillsPath: skills`、`structure: flat`
- 如果有多个目录都含有 skill，则把 `skillsPath` 写成数组

Agent 应优先根据缓存仓库中的实际文件布局做判断，不要仅根据仓库名、README 描述或经验猜测。

### 示例 1：Git 仓库的 skill 目录比较深

例如 skill 实际在 `packages/agent/skills/` 下：

```bash
ki source add https://github.com/acme/product-skills.git \
  --name acme \
  --branch main \
  --skills-path packages/agent/skills \
  --structure nested \
  --skill-file SKILL.md
```

等价的配置文件表现为：

```yaml
sources:
  - name: acme
    provider: git
    url: https://github.com/acme/product-skills.git
    options:
      skillsPath: packages/agent/skills
      structure: nested
      skillFile: SKILL.md
      branch: main
    enabled: true
```

改完后执行：

```bash
ki source sync acme
ki source skills acme
```

### 示例 2：一个 source 有多个 skill 目录

```bash
ki source set acme --skills-path skills/.curated,skills/.system
```

等价的配置文件表现为：

```yaml
sources:
  - name: acme
    provider: git
    url: https://github.com/acme/product-skills.git
    options:
      skillsPath:
        - skills/.curated
        - skills/.system
      structure: nested
      skillFile: SKILL.md
      branch: main
    enabled: true
```

### 示例 3：仓库使用 flat 结构

例如目录下直接是 `brainstorming.md`、`debugging.md`：

```bash
ki source set acme-flat --skills-path skills --structure flat
```

等价的配置文件表现为：

```yaml
sources:
  - name: acme-flat
    provider: git
    url: https://github.com/acme/flat-skills.git
    options:
      skillsPath: skills
      structure: flat
      branch: main
    enabled: true
```

### 示例 4：本地目录 source 也需要同样处理

```bash
ki source add /path/to/repo --name local-team --skills-path packages/ai/skills --structure nested --skill-file SKILL.md
```

等价的配置文件表现为：

```yaml
sources:
  - name: local-team
    provider: local
    url: /path/to/repo
    options:
      skillsPath: packages/ai/skills
      structure: nested
      skillFile: SKILL.md
    enabled: true
```

### 示例 5：先以禁用状态添加 source

```bash
ki source add https://github.com/acme/product-skills.git --name acme --disabled
ki source show acme
ki source set acme --enable
```

## 修改配置时的 Agent 约束

- 如果 CLI 能表达，就优先 `ki source add`、`ki source set`、`ki source unset`、`ki source show`。
- 修改后必须用 `ki source sync <name>` 和 `ki source skills <name>` 验证结果。
- 如果仓库默认分支不是 `main`，再补 `--branch`；不要无依据修改 branch。
- 手动编辑 `config.yaml` 仅限于定位 `ki` 自身 bug 时的临时诊断，不应作为安装或配置任务的交付结果。

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

默认应使用非交互安装。稳定路径是同时指定完整 skill ID，必要时补目标和作用域：

```bash
ki install superpowers:brainstorming -t claude-code
ki install superpowers:brainstorming -t claude-code,cursor
ki install superpowers:brainstorming -t claude-code --project
```

只有用户明确要求交互式选择时，才允许使用下面这些命令：

```bash
ki install -i
ki install brainstorming -i
```

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 技能列表为空 | 源未同步 | `ki source sync` |
| 找不到源 | 配置错误 | 检查 `~/.config/ki/config.yaml` |
| 安装失败 | 目标名称无效或目标工具不可用 | 检查 `targets` 配置和目标工具环境 |
| Git 同步失败 | 网络或权限问题 | 检查 URL 和访问权限 |

## 项目作用域说明

- `ki install --project`、`ki update --project`、`ki uninstall --project` 都以当前工作目录作为项目根目录，请在目标项目目录内执行这些命令。

## SKILL.md 格式

```markdown
---
name: 技能名称
description: 技能描述
---

# 技能标题

技能内容...
```
