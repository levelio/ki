[English](./README.en.md) | 简体中文

<p align="center">
  <img src="./assets/ki-logo.jpg" alt="ki logo" width="260" />
</p>

<h1 align="center">ki</h1>

<p align="center">
  跨工具 Skill 管理器，帮助你在多个 AI 编码工具之间统一管理和同步技能。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ki-skill"><img src="https://img.shields.io/npm/v/ki-skill?logo=npm&color=CB3837" alt="npm version" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white" alt="node >= 20" />
  <a href="https://github.com/levelio/ki/actions/workflows/changeset-check.yml"><img src="https://img.shields.io/github/actions/workflow/status/levelio/ki/changeset-check.yml?branch=main&label=checks" alt="checks" /></a>
  <img src="https://img.shields.io/badge/license-MIT-0E8A16" alt="MIT license" />
  <img src="https://img.shields.io/badge/targets-Claude%20Code%20%7C%20Codex%20%7C%20Cursor-748E49" alt="targets" />
</p>

适合这样的场景：

- 你希望把一套 skills 同时分发到多个 AI 编码工具
- 你希望用 Git 仓库统一管理团队或个人的 skill 来源
- 你希望查看当前安装状态、批量更新，并在出问题时快速自检

## 特性

- 🔌 多源支持，支持 Git 仓库和本地目录
- 🎯 多目标安装，支持安装到多个 AI 工具
- 🔍 交互式搜索与多选安装
- 🔄 更新已安装技能
- 📁 单个源支持多个技能目录
- ⚙️ 通过 CLI 配置 source 的 `branch`、`skillsPath`、`structure`、`skillFile`

## 环境要求

- Node.js 20+
- npm

## 安装

```bash
npm install -g ki-skill
```

安装后可直接使用：

```bash
ki --help
```

## 快速开始

```bash
# 初始化配置
ki init

# 同步本仓库内置的 ki 技能源
ki source sync ki

# 查看本仓库提供的技能
ki source skills ki

# 安装本仓库自带的 ki-usage skill
ki install ki:ki-usage -t claude-code

# 查看所有可用技能
ki list
```

## 安装本仓库自带 Skill

执行 `ki init` 后，默认配置里已经包含当前仓库的 `ki` Git 源，不需要手动再添加一遍：

```yaml
sources:
  - name: ki
    provider: git
    url: https://github.com/levelio/ki.git
    enabled: true
```

安装 `ki-usage` 的推荐流程：

```bash
ki init
ki source sync ki
ki source skills ki
ki install ki:ki-usage -t claude-code
```

如果你希望安装到多个目标工具，也可以直接指定多个 target：

```bash
ki install ki:ki-usage -t claude-code,cursor
```

## 使用示例

安装完成后，可以在目标 AI 工具里直接要求它使用这个 skill 来处理 `ki` 相关任务，例如：

```text
使用 ki-usage skill，帮我添加一个 Git 技能源，地址是 https://github.com/acme/product-skills.git，源名称叫 acme-skills。
```

```text
使用 ki-usage skill，帮我看一下 acme-skills 这个源中都有哪些技能。
```

```text
使用 ki-usage skill，帮我把 acme-skills 里的 prd-review 技能安装到 claude-code。
```

默认不会自动进入交互模式。如果你已经知道精确的 skill id 和 target，可以直接执行安装：

```bash
ki install superpowers:brainstorming -t codex
```

如果某个 skill 只想在当前仓库生效：

```bash
ki install superpowers:brainstorming -t codex --project
```

如果只想先看变更，不执行写入：

```bash
ki install superpowers:brainstorming -t codex --project --dry-run
ki update --dry-run
```

如果你希望显式进入 TUI 选择模式：

```bash
ki install -i
ki install brainstorming -i
```

`-y/--yes` 已移除。执行安装或卸载时，直接提供精确参数；只有显式传入 `-i/--interactive` 时才会进入安装 TUI。

## 技能源管理工作流

```bash
# 添加一个 Git 源，并显式命名，便于后续 enable/disable/remove
ki source add https://github.com/acme/skills.git --name acme

# 如果你已经知道目录结构，也可以在 add 时直接配置 source options
ki source add https://github.com/acme/product-skills.git \
  --name acme \
  --branch main \
  --skills-path packages/agent/skills \
  --structure nested \
  --skill-file SKILL.md

# 也可以直接添加一个本地目录 source
ki source add ./skills --name local-skills

# 查看当前所有源
ki source list

# 只同步这个源
ki source sync acme

# 查看这个源里有哪些技能
ki source skills acme

# 查看 source 的当前配置、生效值和解析后的路径
ki source show acme

# 修正 source options
ki source set acme --skills-path skills/.curated,skills/.system

# 用 set 显式启用或禁用 source
ki source set acme --disable
ki source set acme --enable

# 删除某些 option override，回退到 provider 默认值
ki source unset acme --branch --skills-path

# 临时停用这个源（保留配置）
ki source disable acme

# 重新启用这个源
ki source enable acme

# 不再使用时，先卸载这个源里已经安装的 skill，再移除 source
# 例如：
# ki uninstall acme:brainstorming -t codex --global
# ki uninstall acme:brainstorming -t codex --project
# ki doctor
ki source remove acme
```

注意：

- `ki source add` 可以自动识别 Git URL 和现有本地目录
- `ki source add`、`ki source set` 支持直接配置 `branch`、`skillsPath`、`structure`、`skillFile`
- `ki source add --disabled` 可以直接以禁用状态创建 source，`ki source set --enable/--disable` 可切换启用状态
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
| `ki install [search]` | 安装精确 skill id；传 `-i/--interactive` 时进入 TUI |
| `ki uninstall [search]` | 卸载精确 skill id，不支持隐式交互 |
| `ki update` | 更新所有已安装技能 |
| `ki source add <git-url-or-path> [flags]` | 添加一个 Git 或本地目录技能源，并可同时设置 source options |
| `ki source set <name> [flags]` | 更新一个已有 source 的 options 或启用状态 |
| `ki source unset <name> [flags]` | 清除一个 source 的 option override，回退默认值 |
| `ki source show <name>` | 查看 source 的配置、生效值和解析后的路径 |
| `ki source remove <name>` | 删除一个技能源 |
| `ki source list` | 列出所有源 |
| `ki source sync [name]` | 同步源 |
| `ki source skills [name]` | 查看源中的技能 |
| `ki source enable <name>` | 启用一个技能源 |
| `ki source disable <name>` | 禁用一个技能源 |
| `ki target list` | 列出所有目标工具 |

## 配置

配置文件位于 `~/.config/ki/config.yaml`

常见情况下，优先使用 CLI 管理 source：

```bash
ki source add <git-url-or-path> --name <name> [--branch ...] [--skills-path ...] [--structure ...] [--skill-file ...]
ki source set <name> [--branch ...] [--skills-path ...] [--structure ...] [--skill-file ...]
ki source unset <name> [--branch] [--skills-path] [--structure] [--skill-file]
ki source show <name>
```

当你需要检查完整配置，或做 CLI 尚未覆盖的调整时，再直接查看和编辑 `config.yaml`。

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

示例：通过 CLI 配置一个深层 skill 目录的 Git source

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

示例：把一个 source 改成多个 skill 目录

```bash
ki source set acme --skills-path skills/.curated,skills/.system
ki source show acme
```

示例：先以禁用状态添加 source，再按需启用

```bash
ki source add https://github.com/acme/product-skills.git --name acme --disabled
ki source show acme
ki source set acme --enable
```

## 开发

```bash
npm install
npm run check
npm run format
npm run dev
npm test
npm run build
npm run changeset
```

## 发布

项目通过 Changesets 和 GitHub Actions 维护 release PR，并在 release PR 合并后发布到 npm。

发布约束：

- 用户可见的改动应运行 `npm run changeset`
- workflow 使用 `npm ci`、`npm run check`、`npm test`、`npm run build`
- 发布 job 通过 npm trusted publishing 使用 GitHub OIDC，不再依赖长期 `NPM_TOKEN`
- Changesets action 会创建或更新 release PR
- release PR 合并后执行 `npm publish`
- 需要在 npm 包设置中把仓库的 `.github/workflows/release.yml` 配置为 trusted publisher

## 项目作用域说明

- `ki install --project`、`ki update --project`、`ki uninstall --project` 都以当前工作目录作为项目根目录，请在目标项目目录内执行这些命令。

## License

MIT
