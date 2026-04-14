[English](./README.en.md) | 简体中文

# ki

跨工具 Skill 管理器，帮助你在多个 AI 编码工具（Claude Code、Cursor 等）之间统一管理和同步技能。

## 特性

- 🔌 多源支持，支持 Git 仓库和本地目录
- 🎯 多目标安装，支持安装到多个 AI 工具
- 🔍 交互式搜索与多选安装
- 🔄 更新已安装技能
- 📁 单个源支持多个技能目录

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
ki install ki:ki-usage -t claude-code -y

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
ki install ki:ki-usage -t claude-code -y
```

如果你希望安装到多个目标工具，也可以直接指定多个 target：

```bash
ki install ki:ki-usage -t claude-code,cursor -y
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

## 命令参考

| 命令 | 说明 |
|------|------|
| `ki init` | 初始化配置文件 |
| `ki list` | 列出所有可用技能 |
| `ki install [search]` | 安装技能 |
| `ki uninstall [search]` | 卸载技能 |
| `ki update` | 更新所有已安装技能 |
| `ki source list` | 列出所有源 |
| `ki source sync [name]` | 同步源 |
| `ki source skills [name]` | 查看源中的技能 |
| `ki target list` | 列出所有目标工具 |

## 配置

配置文件位于 `~/.config/ki/config.yaml`

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
  - name: cursor
    enabled: true
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

## 当前限制

- `ki install --project` 可以写入项目目录，但项目级安装的后续 `ki update` / `ki uninstall` 还没有完整闭环，当前推荐优先使用全局安装。

## License

MIT
