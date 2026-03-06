# LazySkill 设计文档

## 概述

LazySkill 是一个跨工具的 Skill 管理器，帮助用户在多个 AI 编码工具（Claude Code、Cursor、OpenCode 等）之间统一管理和同步 skills。

### 解决的问题

1. **安装/升级/删除** - 在多个工具中安装、升级、删除 skills
2. **快速启用/禁用** - 按工具配置不同的 skills，快速开关
3. **多源管理** - 从社区源、私有源获取 skills，支持自定义来源

---

## 核心概念

### Skill

```
Skill = 一组可被 AI 工具使用的指令/规则文件
```

每个 Skill 包含：
- **元数据** - 名称、描述、来源
- **内容文件** - `.md` 或 `.txt` 规则文件
- **目标工具** - 支持哪些工具（claude-code、cursor、opencode...）

### Source（源）

```
Source = Skill 的来源仓库
```

支持类型：
- **GitHub / Git 仓库** - 任意 Git 托管平台
- **本地目录** - 本地文件系统
- **自定义** - 通过脚本适配任意来源

### Target（目标）

```
Target = 目标工具的适配器，负责将 skill 写入/移除到对应工具
```

每个工具的 skill 存放位置：

| 工具 | 全局路径 | 项目路径 | 文件格式 |
|------|----------|----------|----------|
| Claude Code | `~/.claude/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` | 目录 + `SKILL.md` |
| Cursor | `~/.cursor/skills/<name>/SKILL.md` | `.cursor/skills/<name>/SKILL.md` | 目录 + `SKILL.md` |

> **注意**:
> - Claude Code 和 Cursor 都使用目录结构，每个 skill 是一个包含 `SKILL.md` 的目录
> - Cursor 还支持 `.agents/skills/` 作为项目级目录

### Provider（发现器）

```
Provider = 发现脚本，负责从特定源提取 skill 列表
```

---

## Provider 体系

### 内置 Provider

| Provider | 说明 |
|----------|------|
| **git** | 处理 Git 仓库（GitHub、GitLab、自建等），GitHub 优先使用 API |
| **local** | 处理本地目录 |

### 自定义 Provider

用户可编写自定义 Provider 脚本处理特殊源。

```
~/.config/lazyskill/providers/
├── superpowers.ts    # 预装
├── my-company.ts     # 用户自定义
└── ...
```

### Provider 接口

```typescript
interface Provider {
  name: string

  // 发现源中的所有 skills
  discover(config: SourceConfig): Promise<SkillMeta[]>

  // 获取单个 skill 的内容
  fetchSkillContent(skill: SkillMeta): Promise<SkillContent>

  // 可选：检查源是否有更新
  checkForUpdates?(config: SourceConfig): Promise<boolean>
}
```

### Provider 返回数据

**discover() 返回：**

```typescript
interface SkillMeta {
  id: string              // 唯一标识，如 "superpowers:brainstorming"
  name: string            // 显示名称
  description?: string    // 描述
  author?: string         // 作者
  targets?: string[]      // 支持的目标工具
  tags?: string[]         // 标签

  // 内部使用
  _source: string         // 所属源名称
  _path: string           // 在源中的路径/地址
}
```

**fetchSkillContent() 返回：**

```typescript
interface SkillContent {
  id: string              // skill id
  content: string         // skill 文件内容（markdown/text）
  checksum: string        // 内容校验（用于检测更新）
}
```

---

## Target 体系

### 内置 Target

```
~/.config/lazyskill/targets/
├── claude-code.ts
├── cursor.ts
└── opencode.ts
```

### 自定义 Target

```
~/.config/lazyskill/targets/
├── windsurf.ts
├── cline.ts
└── ...
```

### Target 接口

```typescript
interface Target {
  name: string

  // 安装 skill
  install(skill: SkillContent, options?: InstallOptions): Promise<void>

  // 卸载 skill
  uninstall(skillId: string): Promise<void>

  // 列出已安装的 skills
  list(): Promise<InstalledSkill[]>

  // 启用/禁用 skill
  enable(skillId: string): Promise<void>
  disable(skillId: string): Promise<void>
}

interface InstallOptions {
  scope: 'global' | 'project'
  projectPath?: string
}
```

### 已安装 Skill 记录

```typescript
interface InstalledSkill {
  id: string
  source: string
  target: string
  scope: 'global' | 'project'
  checksum: string        // 安装时的内容校验（用于检测更新）
  installedAt: string
  enabled: boolean
}
```

---

## 版本与更新策略

### 基于内容 Checksum 检测更新

不使用版本号，通过文件内容的 checksum 检测是否有更新：

```
1. 用户执行 sync → 获取源中所有 skill 的 checksum
2. 对比本地已安装 skill 的 checksum
3. 有差异 → 标记为 🔄 有更新
4. 用户按 R → 拉取最新内容
```

### 更新详情页（显示 Diff）

```
┌─ SKILLS ─────────────┬─ frontend 🔄 ───────────────────────────────┐
│ ✅ brainstorming     │                                             │
│ ✅ debugging         │ Status: Update available                    │
│ 🔄 frontend          │ Installed: 3 days ago                       │
│ ⬜ tdd               │                                             │
│                      │ ── Diff ──────────────────────────────────  │
│                      │ - ## Frontend Design                        │
│                      │ + ## Frontend Design v2                     │
│                      │                                             │
│                      │ - Focus on React components                 │
│                      │ + Focus on React and Vue components         │
│                      │ +                                          │
│                      │ + ## New Section                           │
│                      │ + Support for Tailwind CSS                 │
│                      │                                             │
├──────────────────────┴─────────────────────────────────────────────┤
│ R:update  ↓↑:scroll  Esc:back  q:quit                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 安装策略

### 全局 vs 项目级

| Scope | 说明 | 安装位置示例 |
|-------|------|-------------|
| **Global** | 所有项目可用 | `~/.claude/commands/` |
| **Project** | 仅当前项目可用 | `.claude/commands/` |

### 快捷键区分

| 快捷键 | 功能 |
|--------|------|
| `I` | 安装到全局 |
| `P` | 安装到项目（当前目录） |

### 编辑弹窗中选择 Scope

```
┌─ Edit: brainstorming ──────────────────────────────────────────────┐
│                                                                     │
│   Select targets to enable:                                         │
│                                                                     │
│   ◉ claude-code      ~/.claude/commands/brainstorming.md           │
│   ◉ cursor           .cursor/rules/brainstorming.md                │
│   ◯ opencode         (not installed)                               │
│                                                                     │
│   ────────────────────────────────────────────────────────────────│
│   Scope: [◉ Global]  [◯ Project]                                    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ ↑/↓:navigate  Space:toggle  Tab:switch scope  Enter:save           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## TUI 界面设计

### 整体布局（Lazygit 风格）

```
┌─ SKILLS ─────────────┬─ brainstorming ─────────────────────────────┐
│ ✅ brainstorming     │                                             │
│ ✅ debugging         │ Source: superpowers                         │
│ ⬜ tdd               │                                             │
│ 🔄 frontend          │ ── Description ───────────────────────────  │
│ 📦 my-custom         │ Turn ideas into fully formed designs        │
│                      │ through natural collaborative dialogue.     │
├─ SOURCES ────────────│                                             │
│ ◉ superpowers (12)   │ ── Installed ────────────────────────────    │
│ ◉ community (8)      │ ◉ claude-code    ~/.claude/commands/...     │
│ ◯ my-private (3)     │ ◉ cursor         .cursor/rules/...          │
│                      │ ◯ opencode       (not installed)            │
├─ TARGETS ────────────│                                             │
│ ◉ claude-code (5)    │                                             │
│ ◉ cursor (3)         │                                             │
│ ◯ opencode (0)       │                                             │
├──────────────────────┴─────────────────────────────────────────────┤
│ /:search  Enter:edit  I:install  P:project  U:uninstall  q:quit   │
└─────────────────────────────────────────────────────────────────────┘
```

### 区域说明

| 区域 | 功能 |
|------|------|
| **SKILLS** | 浏览所有可用 skills，查看安装状态 |
| **SOURCES** | 管理源，启用/禁用、同步 |
| **TARGETS** | 管理目标工具，查看已安装 skills |

### 状态符号

**Skills：**

| 符号 | 含义 |
|------|------|
| ⬜ | 未安装 |
| ✅ | 已安装且启用 |
| ⏸️ | 已安装但禁用 |
| 📦 | 本地 skill |
| 🔄 | 有更新可用 |

**Sources：**

| 符号 | 含义 |
|------|------|
| ◉ | 启用（参与搜索、列表展示） |
| ◯ | 禁用（不展示其 skills） |

### 快捷键

**全局：**

| 按键 | 功能 |
|------|------|
| `Tab` | 切换左侧区域 |
| `↑` `↓` / `j` `k` | 区域内导航 |
| `/` | 搜索 |
| `v` | 进入/退出视觉模式 |
| `q` | 退出 |

**SKILLS 区域：**

| 按键 | 功能 |
|------|------|
| `Enter` | 编辑 targets（弹出多选框） |
| `I` | 安装到全局 |
| `P` | 安装到项目 |
| `U` | 卸载 |
| `R` | 更新（有更新时） |

**SOURCES 区域：**

| 按键 | 功能 |
|------|------|
| `S` | 同步 |
| `E` | 启用/禁用 |

**TARGETS 区域：**

| 按键 | 功能 |
|------|------|
| `E` | 启用/禁用 target |
| `C` | 配置 |

**视觉模式：**

| 按键 | 功能 |
|------|------|
| `v` | 进入/退出视觉模式 |
| `j` `k` / `↑` `↓` | 扩展选择范围 |
| `I` `P` `U` `R` | 对选中项执行批量操作 |
| `Esc` | 退出视觉模式 |

### 视觉模式界面

```
┌─ SKILLS [VISUAL] ─────┬─ 3 selected ────────────────────────────────┐
│ ━━━━━━━━━━━━━━━━━━━━ │                                             │
│ ■ brainstorming      │ Selected:                                   │
│ ■ debugging          │ • brainstorming                             │
│ ■ tdd                │ • debugging                                 │
│ ━━━━━━━━━━━━━━━━━━━━ │ • tdd                                       │
│ ⬜ frontend          │                                             │
│ 📦 my-custom         │ ── Actions ───────────────────────────────  │
│                      │ I:install to global                         │
│                      │ P:install to project                        │
│                      │ U:uninstall                                 │
│                      │ R:update                                    │
├──────────────────────┴─────────────────────────────────────────────┤
│ j/k:extend  I/P/U/R:action  Esc:exit visual  q:quit               │
└─────────────────────────────────────────────────────────────────────┘
```

### Skill 编辑弹窗

在 SKILLS 区域按 `Enter`：

```
┌─ Edit: brainstorming ──────────────────────────────────────────────┐
│                                                                     │
│   Select targets to enable:                                         │
│                                                                     │
│   ◉ claude-code      ~/.claude/commands/brainstorming.md           │
│   ◉ cursor           .cursor/rules/brainstorming.md                │
│   ◯ opencode         (not installed)                               │
│   ◯ windsurf         (not installed)                               │
│                                                                     │
│   ────────────────────────────────────────────────────────────────│
│   Scope: [◉ Global]  [◯ Project]                                    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ ↑/↓:navigate  Space:toggle  Tab:scope  Enter:save  Esc:cancel      │
└─────────────────────────────────────────────────────────────────────┘
```

### 搜索模式

按 `/` 进入搜索：

```
┌─ SKILLS (5 matches) ───────────────────────────────────────────────┐
│ search: debug                                                       │
├─────────────────────────────────────────────────────────────────────┤
│   superpowers:debugging            claude                          │
│   community:debug-react            -                               │
│   ...                                                               │
├─────────────────────────────────────────────────────────────────────┤
│ Enter:confirm  Esc:cancel search                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 配置文件

### 目录结构

```
~/.config/lazyskill/
├── config.yaml           # 用户配置（与默认配置合并）
├── providers/            # 自定义 Provider
│   ├── superpowers.ts    # 预装
│   └── my-company.ts     # 用户自定义
├── targets/              # 自定义 Target
│   ├── claude-code.ts    # 内置
│   ├── cursor.ts         # 内置
│   ├── opencode.ts       # 内置
│   ├── windsurf.ts       # 用户自定义
│   └── ...
└── cache/                # 缓存目录
    └── ...
```

### 配置文件示例

**位置**：`~/.config/lazyskill/config.yaml`

```yaml
sources:
  - name: superpowers
    provider: superpowers
    url: https://github.com/obra/superpowers.git
    enabled: true

  - name: community
    provider: git
    url: github.com/user/community-skills
    options:
      branch: main
      path: skills
    enabled: true

  - name: my-private
    provider: git
    url: git@github.com:myorg/skills.git
    options:
      credentials:
        type: ssh
    enabled: false

  - name: local-skills
    provider: local
    url: file:///Users/zhiqiang/my-skills
    enabled: true

targets:
  - name: claude-code
    enabled: true

  - name: cursor
    enabled: true

  - name: opencode
    enabled: false

  - name: windsurf
    provider: ./targets/windsurf.ts
    enabled: false
```

### 内置默认配置

程序内置默认配置，用户配置覆盖合并：

```typescript
const defaultConfig = {
  sources: [
    {
      name: 'superpowers',
      provider: 'superpowers',
      url: 'https://github.com/obra/superpowers.git',
      enabled: true,
    },
  ],
  targets: [
    { name: 'claude-code', enabled: true },
    { name: 'cursor', enabled: true },
    { name: 'opencode', enabled: true },
  ],
}
```

### 合并逻辑

```
启动时:
1. 加载内置默认配置
2. 加载 ~/.config/lazyskill/config.yaml（如果存在）
3. 深度合并：用户配置覆盖默认配置
4. 用户未配置的字段使用默认值
```

### 合并示例

**内置默认**：
```yaml
targets:
  - name: claude-code
    enabled: true
  - name: cursor
    enabled: true
  - name: opencode
    enabled: true
```

**用户配置**：
```yaml
targets:
  - name: opencode
    enabled: false
  - name: windsurf
    provider: ./targets/windsurf.ts
    enabled: true
```

**合并结果**：
```yaml
targets:
  - name: claude-code
    enabled: true        # 默认值
  - name: cursor
    enabled: true        # 默认值
  - name: opencode
    enabled: false       # 用户覆盖
  - name: windsurf
    provider: ./targets/windsurf.ts
    enabled: true        # 用户新增
```

### 配置加载时机

- 启动时加载配置
- 修改配置文件后需重启生效

---

## 技术栈

- **运行时**: Bun
- **语言**: TypeScript
- **TUI 框架**: clack（Charmbracelet 出品）
- **分发**: `bun build --compile` 打包成单二进制

---

## CLI 命令

| 命令 | 说明 |
|------|------|
| `skill` | 进入 TUI 界面（默认 skills 列表） |
| `skill sources` | 进入 TUI 界面（sources 区域） |
| `skill targets` | 进入 TUI 界面（targets 区域） |
