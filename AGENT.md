# AGENT.md — ki 项目 AI Agent 协作规范

## 项目概述

ki 是一个开源的 AI Agent Skill Manager CLI 工具，用于跨多个 AI Agent（Claude Code、Gemini CLI、Cursor 等）管理 skill 的安装、更新、卸载和分享。

- **语言**: TypeScript + Bun
- **包管理**: Bun
- **设计文档**: `docs/superpowers/specs/2026-03-31-ki-skill-manager-design.md`
- **代码规范**: 严格类型检查，Biome（lint + format）

## 核心架构

```
CLI Layer → Core Engine → Resolver Layer (解析) + Fetcher Layer (获取) + Target Adapter Layer (安装)
```

关键抽象：
- **Resolver**: 将来源标识（如 `github:user/repo@v1.0`）解析为下载地址
- **Fetcher**: 从下载地址获取文件内容
- **TargetAdapter**: 将 skill 安装到各 Agent 的原生目录

详细接口定义见设计文档「架构设计」章节。

## 开发约定

### 代码结构

- `src/cli/` — 每个 CLI 命令一个文件（如 `install.ts`、`list.ts`）
- `src/core/` — 配置解析、安装引擎、来源解析
- `src/resolvers/` — 每种来源类型一个 Resolver
- `src/fetchers/` — 每种获取方式一个 Fetcher
- `src/targets/` — 每个 Agent 一个 TargetAdapter
- `src/utils/` — 文件操作、日志、Schema 校验等工具函数
- `schemas/` — JSON Schema 定义

### 编码规范

- 使用 TypeScript 严格模式（`strict: true`）
- 每个 Resolver 实现 `Resolver` 接口，每个 TargetAdapter 实现 `TargetAdapter` 接口
- 错误处理使用自定义错误类（`KiError`、`ResolveError`、`FetchError`、`InstallError`）
- 日志通过 `src/utils/logger.ts` 统一输出，不直接使用 `console.log`
- 异步操作统一使用 `async/await`，不使用回调
- 文件路径使用 `path.join()` / `path.resolve()`，不拼接字符串

### 错误处理模式

自定义错误类层次：

```
KiError（基类，含 code 和 exitCode）
├── ConfigError        # 配置文件解析/校验错误（exitCode: 1）
├── ResolveError       # 来源解析失败（exitCode: 1）
├── FetchError         # 内容获取失败（exitCode: 1）
├── InstallError       # 安装/卸载失败（exitCode: 1）
├── AgentError         # Agent 相关错误（exitCode: 1）
└── CLIError           # 参数/用法错误（exitCode: 2）
```

规则：
- 所有面向用户的错误使用自定义错误类，不抛裸 Error
- 错误消息以大写字母开头，不含句号（如 "Repository not found: user/repo"）
- 批量操作中单个失败不抛出，收集后统一输出摘要，最终退出码 1
- 网络错误包装为 FetchError，附带原始错误信息

### CLI 输出规范

- 正常输出通过 `src/utils/logger.ts` 统一管理，不直接使用 `console.log`
- 输出级别：`info`（默认）、`success`（绿色 ✓）、`warn`（黄色 ⚠）、`error`（红色 ✗）
- 支持命令行参数控制：`--quiet`（只输出错误）、`--verbose`（输出详细信息）、`--debug`（输出调试信息含堆栈）
- 进度提示：批量操作显示 `Installing 3/5...`，完成后输出摘要表
- 列表输出：对齐列格式（名称、来源、Agent），可用 `--json` 切换为 JSON 输出（方便管道处理）
- 颜色通过 `picocolors` 库实现，自动检测终端支持
- 颜色在非 TTY 环境（CI、管道）下自动禁用

### 开发流程：严格 TDD

所有功能开发必须遵循 TDD（测试驱动开发）流程，不允许先写实现再补测试。

**红-绿-重构循环：**

1. **红**：先编写测试用例，运行确认失败
2. **绿**：编写最小实现使测试通过
3. **重构**：在测试保护下重构代码

**规则：**
- 没有失败的测试，不允许写实现代码
- 每次只写一个测试，只实现使其通过的最少代码
- 使用 Bun 内置测试框架（`bun test`）
- 测试文件放在对应源文件旁，命名为 `*.test.ts`
- 测试覆盖三类：正向（happy path）、反向（合法但不应成功的操作）、异常（外部故障）
- 设计文档「异常 Case 处理」章节是测试用例的权威来源
- Mock 外部依赖（网络、文件系统、git 操作），不 mock 内部模块
- 每次提交前确保所有测试通过（`bun test`）

### 命名规范

- 文件名：kebab-case（如 `claude-code.ts`）
- 类名：PascalCase（如 `GitHubResolver`）
- 接口名：PascalCase，不加 `I` 前缀（如 `Resolver`、`TargetAdapter`）
- 函数/变量：camelCase
- 常量：UPPER_SNAKE_CASE
- CLI 命令参数：kebab-case（如 `--agent`、`--scenario`）

### 配置文件格式

- 所有配置文件使用 JSON 格式
- 支持 `$schema` 字段用于编辑器校验
- JSON Schema 文件位于 `schemas/ki.json`

### 跨平台兼容

ki 必须在 macOS、Linux、Windows 三个平台正常工作：

- 路径处理：始终使用 `path.join()` / `path.resolve()`，不硬编码 `/` 或 `\`
- 软链兼容：Windows 上使用 `fs.symlink()` 的 `type` 参数（`'file'` / `'dir'` / `'junction'`）；Windows 不支持文件级 symlink 时自动降级为复制，并输出 warning
- 文件权限：不在 Windows 上依赖 `chmod`；需要时可执行属性通过扩展名（`.exe`、`.cmd`）保证
- 编码：读写文件统一使用 UTF-8
- 换行符：`.gitattributes` 中设置 `* text=auto`，避免 CRLF/LF 问题
- Home 目录：使用 `os.homedir()` 获取，不硬编码 `/Users/` 或 `/home/`

## 构建与运行

```bash
bun install                # 安装依赖
bun test                   # 运行测试
bun run dev                # 开发模式运行
bun run build              # 编译
bunx biome check .         # lint + format 检查
bunx biome check --fix .   # lint + format 自动修复
bun run typecheck          # 类型检查
```

## 开源协作流程

### 分支与提交

- 分支命名：`feat/<feature>`、`fix/<bug>`、`docs/<topic>`
- 提交信息格式：`type(scope): message`（如 `feat(install): add --from flag`）
- 类型：feat、fix、docs、refactor、test、chore
- 保持提交原子性：每个提交只做一件事
- 提交前必须通过：`bun test && bunx biome check . && bun run typecheck`

### 版本管理

- 遵循 SemVer（语义化版本）
- 版本号在 `package.json` 中维护
- CHANGELOG 由 `git log` 按类型自动生成，不手动维护
- 使用 `bun run release` 发版（patch/minor/major）

### PR 规范

- PR 模板包含：变更说明、关联 Issue、测试说明、检查清单
- PR 标题遵循提交信息格式
- PR 要求：测试通过、Biome 检查通过、类型检查通过
- 新功能必须包含测试
- 新命令必须更新设计文档中的异常 Case

## 构建与运行

```bash
bun install          # 安装依赖
bun test             # 运行测试
bun run dev          # 开发模式运行
bun run build        # 编译
bunx biome check .   # lint + format 检查
bunx biome check --fix .  # lint + format 自动修复
bun run typecheck    # 类型检查
```

## 分期交付

当前处于 **Phase 1（MVP）**，范围：
- `ki init` / `ki install` / `ki uninstall` / `ki list`
- GitHub + local 两种来源
- Claude Code 一个 Target
- 项目级 `.ki.json`

后续 Phase 详见设计文档「分期交付」章节。实现新功能时务必确认当前 Phase 范围，不要提前实现后续 Phase 的内容。

## 设计文档为权威来源

当本文件与设计文档有冲突时，以设计文档为准。实施前务必先阅读完整设计文档。

## 注意事项

- 不要在 Phase 1 实现 registry、marketplace、场景等后续 Phase 的功能
- TargetAdapter 只操作 Agent 的 skill 目录（如 `.claude/skills/`），不操作 plugin 全体系
- 安装方式：`local:` 默认软链，其他来源默认复制
- 不使用 lock 文件，通过来源标识中的版本保证可复现
