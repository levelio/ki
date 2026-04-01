# ki - AI Agent Skill Manager 设计文档

## 概述

ki 是一个 CLI 工具，用于管理 AI Agent（Claude Code、Gemini CLI、Cursor 等）的 skill。采用声明式配置文件描述依赖，CLI 负责解析安装。使用 TypeScript + Bun 开发。

**范围界定：** ki 只管理 skill（技能文件），不管理 Agent 的完整 plugin 体系（如 Claude Code 的 commands、agents、hooks、MCP 配置等）。这些由各 Agent 自身的插件系统负责。ki 的 ClaudeCodeAdapter 只操作 `.claude/skills/` 目录。

## 核心概念

### Skill（技能）

ki 管理的最小单元，可以是单文件或目录。

### Source（来源）

skill 的获取渠道，支持多种类型：

| 来源 | 版本策略 | 语法示例 |
|------|----------|----------|
| `github` | git tag/branch/commit | `github:user/repo@v1.0` |
| `gitlab` | git tag/branch/commit | `gitlab:user/repo@v1.0` |
| `git` | git tag/branch/commit（任意 Git 托管） | `git:https://git.myco.com/repo@v1.0` |
| `local` | 无版本，用当前状态 | `local:./my-skills/helper` |
| `http` | ETag/Last-Modified 或 URL 内嵌版本 | `http:example.com/skill@1.0` |
| `registry` | semver | `registry:skill-name@^1.0` |
| `marketplace` | 随 marketplace plugin 版本 | `marketplace:plugin@marketplace-name` |

省略前缀时默认从 registry 查找。`github:` 和 `gitlab:` 是 `git:` 的快捷方式。

### Skill 定位策略

当来源中没有明确指定 skill 文件位置时（如 GitHub 仓库），ki 使用三级策略定位 skill：

**优先级：来源标识中的路径 > `ki-skill.json` manifest > 约定猜测**

1. **来源标识中指定路径**（最高优先级）：
   - `github:user/repo@v1.0:path/to/skill` — 精确指向文件或目录
   - `github:user/repo@v1.0:skills/` — 指向目录

2. **仓库内 `ki-skill.json` manifest**（repo 作者主动支持 ki）：
   ```json
   {
     "name": "my-skill",
     "version": "1.0.0",
     "skillPath": "skills/"
   }
   ```
   ki 在仓库根目录查找此文件，读取 `skillPath` 定位。

3. **约定猜测**（兜底，按顺序尝试）：
   - 查找根目录 `ki-skill.json`
   - 查找 `skills/` 目录
   - 查找根目录 `*.md` 文件（单文件 skill）
   - 都找不到则报错，提示用户指定路径

### Target（目标 Agent）

skill 的安装目标。ki 将 skill 安装到每个 Agent 原生识别的位置，不发明新的存放路径。

| Agent | 项目级路径 | 全局路径 |
|-------|-----------|---------|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Gemini CLI | 待确认 | 待确认 |
| Cursor | 待确认 | 待确认 |

Agent 自己负责合并全局 + 项目级 skill。

### Scenario（场景）

全局级的 profile 机制，类似 kubectl context。默认存在 `default` 场景，用户可创建新场景并切换。

## 配置文件

所有配置使用 JSON 格式，支持 `$schema` 字段用于编辑器校验和自动补全。

### JSON Schema

ki 提供官方 JSON Schema：`https://ki.dev/schema/ki.json`

```json
{
  "$schema": "https://ki.dev/schema/ki.json",
  "skills": { ... }
}
```

`ki init` 创建的 `.ki.json` 默认包含 `$schema` 字段。

### 配置合并语义

项目级和全局级配置按以下规则合并：

| 字段 | 合并策略 | 说明 |
|------|----------|------|
| `skills` | 项目级覆盖全局级同名项 | 同名 skill 以项目级为准 |
| `registries` | 累加合并 | 所有层级的 registry 均生效 |
| 其他设置 | 项目级覆盖全局级 | |

### 项目级 `.ki.json`

随项目 Git 提交，声明项目所需的 skill：

```json
{
  "$schema": "https://ki.dev/schema/ki.json",
  "skills": {
    "tdd": "github:superpowers/tdd@v2.1",
    "debug": "registry:systematic-debugging@^1.0",
    "local-helper": "local:./my-skills/helper"
  }
}
```

### 全局级 `~/.ki/config.json`

```json
{
  "currentScenario": "default",
  "registries": [
    "https://registry.ki.dev"
  ]
}
```

### 场景文件 `~/.ki/scenarios/<name>.json`

```json
{
  "skills": {
    "debug": "registry:systematic-debugging@^1.0"
  }
}
```

### 分享机制

分享即传递一个标准 `.ki.json` 配置文件（可托管到 HTTP URL、Gist 等），接收方通过 `ki install --from <url>` 安装。

## 自定义 Agent

用户通过 `~/.ki/agents/*.json` 声明自定义 Agent：

```json
{
  "name": "my-agent",
  "displayName": "My Custom Agent",
  "projectSkillDir": ".my-agent/skills",
  "globalSkillDir": "~/.my-agent/skills",
  "filePattern": "*.md",
  "detect": {
    "file": "~/.my-agent/config.yaml"
  }
}
```

ki 的 `ConfigDrivenAdapter` 读取此 JSON，自动生成 Target Adapter 行为。

## CLI 命令

### 核心

```
ki init                     # 初始化 .ki.json
ki install                  # 安装 .ki.json 中所有 skill
ki install <source>         # 安装单个 skill（加入 .ki.json）
ki install --from <url>     # 从远程配置文件批量安装
ki uninstall <name>         # 卸载 skill
ki list                     # 列出项目级已安装 skill
ki update [name]            # 更新项目级 skill
```

### 安装目标

```
ki install <skill> --agent claude-code   # 装到指定 Agent
ki install <skill>                       # 装到所有检测到的 Agent
```

### 安装方式

默认行为：`local:` 来源使用软链（symlink），其他来源使用复制（copy）。

```
ki install local:./skills/helper         # 软链（默认）
ki install local:./skills/helper --copy  # 强制复制
ki install github:user/repo@v1.0         # 复制（默认）
ki install github:user/repo@v1.0 --link  # 强制软链（指向 cache）
```

### 列表查询

```
ki list                                 # 项目级 skill
ki list --global                        # 当前场景全局 skill
ki list --all                           # 项目级 + 全局
ki list --agent claude-code             # 筛选指定 Agent 的 skill
ki list --global --agent claude-code    # 指定 Agent 的全局 skill
```

输出示例：
```
Skills (project):
  debug    registry:systematic-debugging@^1.0    [claude-code, gemini-cli]
  tdd      github:superpowers/tdd@v2.1           [claude-code]

Skills (global / scenario: work):
  review   registry:code-review@^2.0             [claude-code]
```

### 全局安装

```
ki install <skill> --global              # 安装到当前场景
ki install <skill> --global --scenario work  # 安装到指定场景
```

### 更新范围

```
ki update                        # 更新项目级所有 skill
ki update <name>                 # 更新项目级指定 skill
ki update --global               # 更新当前场景全局 skill
ki update --global <name>        # 更新指定全局 skill
ki update --all                  # 项目级 + 全局全部更新
```

### 场景

```
ki scenario list              # 列出所有场景
ki scenario create <name>     # 创建新场景
ki scenario switch <name>     # 切换场景
ki scenario delete <name>     # 删除场景（default 不可删）
```

### Agent

```
ki agent list                 # 列出支持的 Agent
ki agent add <config-path>    # 添加自定义 Agent
```

### Registry

```
ki search <keyword>           # 搜索 skill
ki publish                    # 发布 skill 到 registry
```

### 诊断

```
ki doctor                     # 环境诊断
```

输出示例：
```
✓ .ki.json found and valid
✓ Claude Code detected (v2.x)
✗ Gemini CLI not detected
✓ Registry reachable (https://registry.ki.dev)
✓ 3 skills installed, 0 with issues
```

`ki doctor` 检查项：配置文件存在性及格式、各 Agent 检测状态、Registry 连通性、已安装 skill 一致性。

## 架构设计

### 分层

```
┌──────────────────────────────────────────────┐
│              CLI Layer                        │  命令解析、用户交互
├──────────────────────────────────────────────┤
│           Core Engine                        │  配置解析、安装编排
├───────────┬───────────┬──────────────────────┤
│ Resolver  │  Target   │                      │
│  Layer    │  Adapter  │  Fetcher Layer       │
│ (解析层)  │  (安装层) │  (获取层)             │
├───────────┴───────────┴──────────────────────┤
│            Cache / Storage                   │  缓存、状态管理
└──────────────────────────────────────────────┘
```

### Resolver + Fetcher 双层抽象

Resolver 负责将来源标识解析为具体下载地址，Fetcher 负责从地址获取文件内容。两者正交组合，新增 marketplace 只需加 Resolver，Fetcher 复用已有实现。

```typescript
// Resolver: 名称 → 下载地址
interface Resolver {
  type: string;
  resolve(spec: string): Promise<ResolvedLocation>;
}

// Fetcher: 下载地址 → 文件内容
interface Fetcher {
  fetch(location: ResolvedLocation): Promise<SkillPackage>;
  // 可选：从 package 中提取 skill 部分（如 marketplace plugin 中的 skills/ 目录）
  extract?(pkg: SkillPackage, pattern: string): Promise<SkillPackage>;
}
```

内置 Resolver：

| Resolver | 说明 | 配套 Fetcher |
|----------|------|-------------|
| `GitHubResolver` | 解析 `github:` 标识为 git 地址 | `GitFetcher` |
| `GitLabResolver` | 解析 `gitlab:` 标识为 git 地址 | `GitFetcher` |
| `GitResolver` | 解析 `git:` 任意 URL 为 git 地址 | `GitFetcher` |
| `LocalResolver` | 解析 `local:` 为本地路径 | `LocalFetcher` |
| `HttpResolver` | 解析 `http:` 为下载 URL | `HttpFetcher` |
| `RegistryResolver` | 调 registry API 查版本和下载地址 | `HttpFetcher` |
| `MarketplaceResolver` | 读 marketplace manifest → 找 plugin source | `GitFetcher` + `extract` |

内置 Fetcher：`GitFetcher`、`HttpFetcher`、`LocalFetcher`

### Marketplace 兼容性

ki 将 Claude Code Marketplace 作为 `marketplace:` 来源类型。安装时：
1. 解析 marketplace 标识（如 `marketplace:superpowers@superpowers-marketplace`）
2. 通过 MarketplaceResolver 读 `marketplace.json` 找到 plugin source
3. 拉取 plugin 内容
4. 只提取 `skills/` 目录（忽略 commands、agents、hooks、MCP 等）
5. 通过 Target Adapter 安装到 Agent 的 skill 目录

未来新增 marketplace（如 Gemini Skill Hub、Cursor Marketplace）只需新增 Resolver，Fetcher 复用已有实现。部分 marketplace 可通过声明式配置接入：

```json
{
  "type": "marketplace",
  "name": "cursor-marketplace",
  "indexUrl": "https://marketplace.cursor.dev/api/skills",
  "skillPath": "skills/",
  "responseFormat": "cursor-v1"
}
```

### Target Adapter 接口

```typescript
interface TargetAdapter {
  name: string;
  detect(): boolean;
  install(skill: SkillPackage, scope: 'project' | 'global'): Promise<void>;
  uninstall(skillName: string, scope: 'project' | 'global'): Promise<void>;
  list(): Promise<InstalledSkill[]>;
  getInstallPath(scope: 'project' | 'global'): string;
}
```

内置实现：`ClaudeCodeAdapter`、`GeminiCliAdapter`、`CursorAdapter`、`ConfigDrivenAdapter`

### 安装流程

1. 解析 `.ki.json`（项目级）和 `~/.ki/scenarios/<current>.json`（全局级）
2. 对每个 skill，根据前缀选择 Resolver，将来源标识解析为具体下载地址
3. Fetcher 从下载地址获取文件内容（marketplace 类型会提取 skill 部分）
4. 检测已安装的 Agent（`detect()`）
5. 根据 `--agent` 参数过滤目标
6. 通过 Target Adapter 将 skill 安装到对应 Agent 的原生目录
7. 项目级安装到 Agent 的项目 skill 目录，全局级安装到 Agent 的全局 skill 目录

### 不使用 lock 文件

ki 的模型接近 brew 而非 npm。通过来源标识中的版本保证可复现（如 `@v1.0`、`@abc123`），不需要额外的 lock 文件。

## 项目结构

```
ki/
├── src/
│   ├── cli/                    # CLI 命令
│   │   ├── index.ts
│   │   ├── install.ts
│   │   ├── uninstall.ts
│   │   ├── list.ts
│   │   ├── update.ts
│   │   ├── search.ts
│   │   ├── publish.ts
│   │   ├── scenario.ts
│   │   ├── agent.ts
│   │   └── doctor.ts
│   ├── core/
│   │   ├── config.ts           # 配置解析（含合并逻辑）
│   │   ├── engine.ts           # 安装编排（含生命周期钩子）
│   │   └── resolver.ts         # 来源标识解析
│   ├── resolvers/
│   │   ├── resolver.ts         # Resolver 接口
│   │   ├── github.ts
│   │   ├── gitlab.ts
│   │   ├── git.ts
│   │   ├── local.ts
│   │   ├── http.ts
│   │   ├── registry.ts
│   │   └── marketplace.ts
│   ├── fetchers/
│   │   ├── fetcher.ts          # Fetcher 接口
│   │   ├── git.ts
│   │   ├── http.ts
│   │   └── local.ts
│   ├── targets/
│   │   ├── adapter.ts          # TargetAdapter 接口
│   │   ├── claude-code.ts
│   │   ├── gemini-cli.ts
│   │   ├── cursor.ts
│   │   └── config-driven.ts
│   └── utils/
│       ├── fs.ts
│       ├── logger.ts
│       └── schema.ts           # JSON Schema 校验
├── schemas/
│   └── ki.json                 # .ki.json 的 JSON Schema
├── package.json
├── tsconfig.json
└── bunfig.toml
```

## 用户侧目录

```
~/.ki/
├── config.json                 # 全局配置
├── scenarios/
│   ├── default.json            # 默认场景
│   ├── work.json
│   └── personal.json
├── agents/                     # 自定义 Agent
│   └── my-agent.json
└── cache/                      # skill 缓存
```

## Registry 协议

Registry 是 HTTP 服务，API 如下：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/skills/{name}` | GET | 获取 skill 信息 |
| `/skills/{name}/{version}` | GET | 获取特定版本 |
| `/skills/{name}/latest` | GET | 获取最新版本 |
| `/search?q=keyword` | GET | 搜索 skill |
| `/publish` | POST | 发布 skill（需认证） |

### Skill 元数据 `ki-skill.json`

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "A useful skill",
  "author": "username",
  "files": ["skill.md", "helper.js"],
  "keywords": ["debug", "testing"],
  "postinstall": "echo 'Skill installed!'",
  "preuninstall": "cleanup.sh"
}
```

`postinstall` 和 `preuninstall` 为可选的生命周期钩子，在安装后/卸载前执行指定命令。

### Scoped 命名空间

registry 支持组织级命名空间，防止名称冲突：

```
registry:@superpowers/tdd@^1.0
registry:@mycompany/internal-skill@^2.0
```

Scope 与 registry 源对应：可在 `~/.ki/config.json` 中为特定 scope 配置 registry 地址：

```json
{
  "registries": [
    "https://registry.ki.dev"
  ],
  "scopedRegistries": {
    "@mycompany": "https://registry.mycompany.com"
  }
}
```

### Registry 响应格式

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "dist": {
    "tarball": "https://registry.ki.dev/skills/my-skill/1.0.0/download",
    "integrity": "sha256-xxx"
  }
}
```

自部署 Registry 只需实现此 API。支持两种模式：

**动态模式**：HTTP 服务实现完整 API。

**静态模式**（零服务器）：纯文件目录结构，可托管到 S3、GitHub Pages、Nginx 等：

```
registry/
├── index.json                          # 全局索引（所有 skill 列表）
├── skills/
│   ├── my-skill/
│   │   ├── index.json                  # 该 skill 的所有版本
│   │   ├── 1.0.0.json                  # 特定版本元数据
│   │   └── 1.0.0/
│   │       └── download.tar.gz         # skill 包
│   └── @mycompany/
│       └── internal-skill/
│           └── ...
```

`ki publish --static` 可生成此目录结构。

## 异常 Case 处理

按 TDD 风格组织：正向（happy path）、反向（合法但不应成功的操作）、异常（外部故障）。

### ki init

| 类型 | Case | 预期行为 |
|------|------|----------|
| 正向 | 项目目录无 `.ki.json` | 创建 `.ki.json`，内容为 `{"skills":{}}` |
| 反向 | `.ki.json` 已存在 | 报错 "Already initialized"，不覆盖 |
| 异常 | 目录无写权限 | 报错 "Permission denied: <path>" |

### ki install（单 skill）

| 类型 | Case | 预期行为 |
|------|------|----------|
| 正向 | `ki install github:user/repo@v1.0` | 解析 → 拉取 → 写入 `.ki.json` → 安装到检测到的 Agent |
| 正向 | `ki install local:./skills/helper` | 复制本地文件到 Agent skill 目录 |
| 正向 | `ki install registry:tdd@^1.0` | 查 registry API → 下载 → 安装 |
| 正向 | `ki install github:user/repo@v1.0:skills/debug` | 克隆后只取指定路径 |
| 正向 | `ki install debug --agent claude-code` | 只安装到 Claude Code |
| 正向 | `ki install debug` 且多个 Agent 存在 | 安装到所有检测到的 Agent |
| 正向 | skill 名称已在 `.ki.json` 但版本不同 | 更新 `.ki.json` 中的条目，重新安装 |
| 反向 | `.ki.json` 不存在 | 报错 "Run `ki init` first" |
| 反向 | 来源标识语法错误（如 `github:` 无 repo） | 报错 "Invalid source spec: <spec>" |
| 反向 | `--agent` 指定了不存在的 Agent | 报错 "Agent not found: <name>"，列出可用 Agent |
| 反向 | `--agent` 指定了未检测到的 Agent | 报错 "Agent not detected: <name>，is it installed?" |
| 反向 | GitHub 仓库不存在 | 报错 "Repository not found: user/repo" |
| 反向 | GitHub tag/branch 不存在 | 报错 "Ref not found: <ref>" |
| 反向 | 本地路径不存在 | 报错 "Path not found: <path>" |
| 反向 | HTTP URL 返回 404 | 报错 "Skill not found at: <url>" |
| 反向 | Registry 中 skill 不存在 | 报错 "Skill not found in registry: <name>" |
| 反向 | marketplace plugin 不存在 | 报错 "Plugin not found: <name>@<marketplace>" |
| 反向 | 仓库中找不到 skill（无 ki-skill.json、无 skills/、无 *.md） | 报错 "Cannot locate skill in repo. Specify path: github:user/repo@ref:path/to/skill" |
| 反向 | skill 名称已在 `.ki.json` 且来源完全相同 | 提示 "Already installed: <name>"，跳过 |
| 异常 | 网络中断（GitHub/Registry/HTTP） | 报错 "Network error: <message>"，退出码 1 |
| 异常 | 磁盘写入失败 | 报错 "Failed to write: <path>: <reason>" |
| 异常 | Agent skill 目录无写权限 | 报错 "Permission denied: <agent-skill-dir>" |
| 异常 | git clone 超时 | 报错 "Clone timed out: <repo>"，建议重试 |

### ki install（批量）

| 类型 | Case | 预期行为 |
|------|------|----------|
| 正向 | `.ki.json` 中 5 个 skill 均有效 | 依次安装全部，输出摘要 |
| 正向 | 5 个 skill 中 2 个失败 | 安装成功的 3 个，失败 2 个报错，退出码 1 |
| 反向 | `.ki.json` 为空 `{"skills":{}}` | 提示 "No skills to install" |
| 反向 | `.ki.json` 格式错误（非法 JSON） | 报错 "Invalid .ki.json: parse error at line X" |
| 异常 | 安装过程中网络中断 | 已完成的保留，未完成的报错，输出摘要 |

### ki install --from <url>

| 类型 | Case | 预期行为 |
|------|------|----------|
| 正向 | URL 指向有效的 `.ki.json` | 下载、解析、安装所有 skill |
| 反向 | URL 不可达 | 报错 "Failed to fetch config: <url>" |
| 反向 | URL 返回的内容不是有效 JSON | 报错 "Invalid config from <url>: parse error" |
| 反向 | 下载的 JSON 中 skill 来源全部无效 | 逐个报错，输出摘要，退出码 1 |

### ki install --global

| 类型 | Case | 预期行为 |
|------|------|----------|
| 正向 | `ki install debug --global` | 安装到当前场景 + 所有检测到的 Agent 全局目录 |
| 正向 | `ki install debug --global --scenario work` | 安装到指定场景 |
| 反向 | `~/.ki/` 不存在 | 自动创建 `~/.ki/` 和 `scenarios/default.json` |
| 反向 | `--scenario` 指定了不存在的场景 | 报错 "Scenario not found: <name>"，列出可用场景 |
| 反向 | Agent 不支持全局 skill 目录 | 跳过该 Agent，提示 "<agent> does not support global skills" |

### ki uninstall

| 类型 | Case | 预期行为 |
|------|------|----------|
| 正向 | `ki uninstall debug` | 从所有 Agent 目录删除 + 从 `.ki.json` 移除 |
| 正向 | `ki uninstall debug --agent claude-code` | 只从 Claude Code 删除 |
| 反向 | skill 未安装 | 报错 "Skill not installed: <name>" |
| 反向 | `.ki.json` 不存在 | 报错 "Run `ki init` first" |
| 异常 | Agent 目录中 skill 文件被锁定/占用 | 报错 "Cannot remove: file in use"，建议关闭 Agent 后重试 |

### ki list

| 类型 | Case | 预期行为 |
|------|------|----------|
| 正向 | `ki list` 项目级有 skill | 列表输出：名称、来源、安装到的 Agent |
| 正向 | `ki list --global` | 列出当前场景的全局 skill |
| 正向 | `ki list --all` | 项目级 + 全局，分组输出 |
| 正向 | `ki list --agent claude-code` | 只显示指定 Agent 下的 skill |
| 反向 | `ki list` 无已安装 skill | 提示 "No skills installed" |
| 反向 | `ki list --global` 场景无 skill | 提示 "No global skills in scenario: <name>" |
| 反向 | `.ki.json` 不存在 | 报错 "Run `ki init` first" |
| 异常 | `.ki.json` 被手动篡改（字段缺失） | 报错 "Corrupted .ki.json: missing 'skills' field" |

### ki update

| 类型 | Case | 预期行为 |
|------|------|----------|
| 正向 | `ki update` 项目级有更新 | 拉取新版本 → 覆盖安装 → 更新 `.ki.json` 中的版本标识 |
| 正向 | `ki update <name>` 更新指定 skill | 只更新指定的 skill |
| 正向 | `ki update --global` | 更新当前场景全局 skill |
| 正向 | `ki update --all` | 项目级 + 全局全部检查更新 |
| 正向 | 已是最新版本 | 提示 "Already up to date: <name>" |
| 反向 | skill 来源已不可达（仓库删除/URL 失效） | 报错 "Source unavailable: <spec>"，不影响其他 skill |
| 反向 | `local:` 来源的 skill（软链） | 提示 "Local skill (symlinked): changes reflected automatically" |
| 反向 | `local:` 来源的 skill（复制） | 从源路径重新复制，提示 "Synced from source" |
| 异常 | 更新过程中网络中断 | 保留当前版本不破坏，报错 "Update failed: network error" |

### ki scenario

| 类型 | Case | 预期行为 |
|------|------|----------|
| 正向 | `ki scenario create work` | 创建 `~/.ki/scenarios/work.json` |
| 正向 | `ki scenario switch work` | 更新 `config.json` 中 `currentScenario` |
| 正向 | `ki scenario list` | 列出所有场景，标记当前活跃场景 |
| 反向 | `create` 名称已存在 | 报错 "Scenario already exists: <name>" |
| 反向 | `switch` 名称不存在 | 报错 "Scenario not found: <name>" |
| 反向 | `delete default` | 报错 "Cannot delete default scenario" |
| 反向 | `delete` 场景下有 skill | 提示 "Scenario has N skills. Use --force to delete"，`--force` 删除场景但保留已安装文件 |
| 异常 | `~/.ki/config.json` 损坏 | 报错 "Corrupted config.json: <reason>"，建议手动修复 |

### ki agent

| 类型 | Case | 预期行为 |
|------|------|----------|
| 正向 | `ki agent list` | 列出内置 Agent（标注已检测/未检测）+ 自定义 Agent |
| 正向 | `ki agent add ./my-agent.json` | 复制到 `~/.ki/agents/` 并注册 |
| 反向 | `add` 的 JSON 缺少必填字段 | 报错 "Invalid agent config: missing 'name'" |
| 反向 | `add` 的 agent 名称与内置冲突 | 报错 "Agent name conflicts with built-in: <name>" |
| 反向 | `add` 的 agent 名称与已有自定义冲突 | 报错 "Agent already exists: <name>. Use --force to overwrite" |

### 配置文件异常

| 类型 | Case | 预期行为 |
|------|------|----------|
| 异常 | `.ki.json` 不是合法 JSON | 报错 "Invalid .ki.json: <parse error>"，提示修复 |
| 异常 | `.ki.json` 缺少 `skills` 字段 | 报错 "Invalid .ki.json: missing 'skills' field" |
| 异常 | `~/.ki/config.json` 不存在 | 自动创建默认配置 |
| 异常 | `~/.ki/scenarios/default.json` 不存在 | 自动创建 |
| 异常 | `.ki.json` 中 skill 来源值为空字符串 | 报错 "Invalid source spec for '<name>': empty" |

### 通用原则

- **部分失败不阻断**：批量操作中某个 skill 失败，不影响其他 skill，最终输出摘要
- **不破坏已安装内容**：更新失败时保留当前版本，卸载失败时不删除 `.ki.json` 条目
- **自动创建缺失目录**：`~/.ki/`、`~/.ki/scenarios/`、`~/.ki/agents/`、`~/.ki/cache/` 首次使用时自动创建
- **退出码**：0 = 全部成功，1 = 有失败，2 = 参数错误

## 分期交付

### Phase 1：核心 CLI（MVP）

- `ki init` / `ki install` / `ki uninstall` / `ki list`
- GitHub + local 两种来源
- Claude Code 一个 Target
- 项目级 `.ki.json`

### Phase 2：多来源 + 多 Agent

- HTTP、Registry 来源
- Gemini CLI、Cursor Target
- 自定义 Agent 支持
- `ki update` / `ki search`

### Phase 3：全局配置 + 场景

- 全局 `~/.ki/config.json`
- 场景创建/切换
- `ki install --global`
- `ki install --from <url>`

### Phase 4：Registry 生态

- `ki publish` 发布
- 自部署 Registry 支持
- `ki search` 多 registry 联搜

## 竞品分析与差异化

### 主要竞品

| 工具 | 定位 | 优势 | 短板 |
|------|------|------|------|
| **PRPM** | 通用 prompt 包管理器，7500+ 包 | 跨 12+ 编辑器自动格式转换、AI 语义搜索 | 中心化、质量参差、很新 |
| **Microsoft APM** | Git 原生 Agent 依赖管理 | 微软背书、传递依赖、供应链安全 | 无搜索发现、文档少、pre-1.0 |
| **claude-plugins.dev** | 社区 Claude 插件注册表 | 简单 CLI、跨平台 | 仅 Claude 生态 |

### ki 的差异化

1. **多来源原生支持**：github/gitlab/git/local/http/registry/marketplace，不只依赖单一 registry
2. **可扩展 Agent**：内置主流 Agent + 声明式自定义 Agent，不锁定特定生态
3. **场景系统**：全局 profile 切换，竞品均无此能力
4. **轻量专注**：只管 skill，不碰 plugin 全体系，降低复杂度
5. **自部署友好**：静态文件模式可零服务器部署 registry
6. **生命周期钩子**：skill 可定义 postinstall/preuninstall
7. **开源中立**：不绑定任何 Agent 厂商
