# LazySkill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-tool skill manager with TUI interface using Bun + TypeScript + clack

**Architecture:** Provider/Target plugin system with lazygit-style TUI. Config-driven with merge support. Checksum-based update detection.

**Tech Stack:** Bun, TypeScript, @clack/core, YAML, Git

---

## Phase 1: Project Setup

### Task 1.1: Initialize Bun Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

**Step 1: Initialize project**

```bash
cd /Users/zhiqiang/Projects/opensource/lazyskill
bun init -y
```

**Step 2: Update package.json with project info**

```json
{
  "name": "lazyskill",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "skill": "./src/cli.ts"
  },
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build ./src/cli.ts --compile --outfile dist/skill",
    "test": "bun test"
  }
}
```

**Step 3: Update tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
```

**Step 5: Commit**

```bash
git init
git add .
git commit -m "chore: initialize bun project"
```

---

### Task 1.2: Install Dependencies

**Files:**
- Modify: `package.json`
- Create: `bun.lockb`

**Step 1: Install dependencies**

```bash
bun add @clack/core @clack/prompts yaml
bun add -d @types/bun
```

**Step 2: Verify installation**

```bash
bun --version
```

**Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: add dependencies"
```

---

### Task 1.3: Create Source Directory Structure

**Files:**
- Create: `src/types/index.ts`
- Create: `src/config/index.ts`
- Create: `src/providers/index.ts`
- Create: `src/targets/index.ts`
- Create: `src/tui/index.ts`
- Create: `src/cli.ts`

**Step 1: Create directory structure**

```bash
mkdir -p src/{types,config,providers,targets,tui}
touch src/types/index.ts
touch src/config/index.ts
touch src/providers/index.ts
touch src/targets/index.ts
touch src/tui/index.ts
touch src/cli.ts
```

**Step 2: Commit**

```bash
git add src/
git commit -m "chore: create source directory structure"
```

---

## Phase 2: Core Types

### Task 2.1: Define Skill Types

**Files:**
- Create: `src/types/skill.ts`
- Create: `src/types/index.ts`

**Step 1: Write the types**

```typescript
// src/types/skill.ts

export interface SkillMeta {
  id: string
  name: string
  description?: string
  author?: string
  targets?: string[]
  tags?: string[]

  // Internal use
  _source: string
  _path: string
}

export interface SkillContent {
  id: string
  content: string
  checksum: string
}

export interface InstalledSkill {
  id: string
  source: string
  target: string
  scope: 'global' | 'project'
  checksum: string
  installedAt: string
  enabled: boolean
}

export type SkillStatus = 'not_installed' | 'installed' | 'disabled' | 'local' | 'update_available'
```

**Step 2: Export from index**

```typescript
// src/types/index.ts
export * from './skill'
```

**Step 3: Commit**

```bash
git add src/types/
git commit -m "feat: add skill type definitions"
```

---

### Task 2.2: Define Provider Types

**Files:**
- Create: `src/types/provider.ts`
- Modify: `src/types/index.ts`

**Step 1: Write the types**

```typescript
// src/types/provider.ts
import type { SkillMeta, SkillContent } from './skill'

export interface SourceConfig {
  name: string
  provider: string
  url: string
  options?: Record<string, unknown>
  enabled: boolean
}

export interface Provider {
  name: string
  discover(config: SourceConfig): Promise<SkillMeta[]>
  fetchSkillContent(skill: SkillMeta): Promise<SkillContent>
  checkForUpdates?(config: SourceConfig): Promise<boolean>
}
```

**Step 2: Update index**

```typescript
// src/types/index.ts
export * from './skill'
export * from './provider'
```

**Step 3: Commit**

```bash
git add src/types/
git commit -m "feat: add provider type definitions"
```

---

### Task 2.3: Define Target Types

**Files:**
- Create: `src/types/target.ts`
- Create: `src/types/config.ts`
- Modify: `src/types/index.ts`

**Step 1: Write target types**

```typescript
// src/types/target.ts
import type { SkillContent, InstalledSkill } from './skill'

export interface InstallOptions {
  scope: 'global' | 'project'
  projectPath?: string
}

export interface Target {
  name: string
  install(skill: SkillContent, options?: InstallOptions): Promise<void>
  uninstall(skillId: string, options?: InstallOptions): Promise<void>
  list(scope: 'global' | 'project', projectPath?: string): Promise<InstalledSkill[]>
  enable(skillId: string, options?: InstallOptions): Promise<void>
  disable(skillId: string, options?: InstallOptions): Promise<void>
  getGlobalPath(): string
  getProjectPath(projectPath: string): string
}
```

**Step 2: Write config types**

```typescript
// src/types/config.ts
import type { SourceConfig } from './provider'

export interface TargetConfig {
  name: string
  provider?: string
  enabled: boolean
}

export interface Config {
  sources: SourceConfig[]
  targets: TargetConfig[]
}

export const DEFAULT_CONFIG: Config = {
  sources: [
    {
      name: 'superpowers',
      provider: 'superpowers',
      url: 'github.com/sst/superpowers-marketplace',
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

**Step 3: Update index**

```typescript
// src/types/index.ts
export * from './skill'
export * from './provider'
export * from './target'
export * from './config'
```

**Step 4: Commit**

```bash
git add src/types/
git commit -m "feat: add target and config type definitions"
```

---

## Phase 3: Configuration

### Task 3.1: Implement Config Loader

**Files:**
- Create: `src/config/loader.ts`
- Modify: `src/config/index.ts`

**Step 1: Write the loader**

```typescript
// src/config/loader.ts
import { parse, stringify } from 'yaml'
import { existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { Config } from '@/types'
import { DEFAULT_CONFIG } from '@/types'

const CONFIG_DIR = join(homedir(), '.config', 'lazyskill')
const CONFIG_FILE = join(CONFIG_DIR, 'config.yaml')

export async function loadConfig(): Promise<Config> {
  // Start with default config
  let config = { ...DEFAULT_CONFIG }

  // Try to load user config
  if (existsSync(CONFIG_FILE)) {
    try {
      const content = await readFile(CONFIG_FILE, 'utf-8')
      const userConfig = parse(content) as Partial<Config>

      // Merge configs
      config = mergeConfig(config, userConfig)
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  return config
}

export async function saveConfig(config: Config): Promise<void> {
  // Ensure directory exists
  await mkdir(CONFIG_DIR, { recursive: true })

  const content = stringify(config)
  await writeFile(CONFIG_FILE, content, 'utf-8')
}

function mergeConfig(defaults: Config, user: Partial<Config): Config {
  return {
    sources: mergeArrays(defaults.sources, user.sources || [], 'name'),
    targets: mergeArrays(defaults.targets, user.targets || [], 'name'),
  }
}

function mergeArrays<T extends { name: string }>(
  defaults: T[],
  user: Partial<T>[],
  key: keyof T
): T[] {
  const result = [...defaults]
  const userMap = new Map(user.map(item => [item[key], item]))

  for (const [name, userItem] of userMap) {
    const defaultIndex = result.findIndex(item => item[key] === name)

    if (defaultIndex >= 0) {
      // Merge with default
      result[defaultIndex] = { ...result[defaultIndex], ...userItem } as T
    } else {
      // Add new item
      result.push(userItem as T)
    }
  }

  return result
}

export function getConfigDir(): string {
  return CONFIG_DIR
}

export function getCacheDir(): string {
  return join(CONFIG_DIR, 'cache')
}
```

**Step 2: Update index**

```typescript
// src/config/index.ts
export * from './loader'
```

**Step 3: Commit**

```bash
git add src/config/
git commit -m "feat: implement config loader with merge support"
```

---

## Phase 4: Utilities

### Task 4.1: Implement Checksum Utility

**Files:**
- Create: `src/utils/checksum.ts`
- Create: `src/utils/index.ts`

**Step 1: Write checksum utility**

```typescript
// src/utils/checksum.ts
import { createHash } from 'crypto'

export function computeChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export function computeFileChecksum(content: string): string {
  return `sha256:${computeChecksum(content)}`
}
```

**Step 2: Write diff utility**

```typescript
// src/utils/diff.ts

export interface DiffLine {
  type: 'add' | 'remove' | 'context'
  content: string
}

export function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const result: DiffLine[] = []

  // Simple line-by-line diff
  const maxLen = Math.max(oldLines.length, newLines.length)

  let oldIdx = 0
  let newIdx = 0

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx >= oldLines.length) {
      // Remaining new lines are additions
      result.push({ type: 'add', content: newLines[newIdx] })
      newIdx++
    } else if (newIdx >= newLines.length) {
      // Remaining old lines are removals
      result.push({ type: 'remove', content: oldLines[oldIdx] })
      oldIdx++
    } else if (oldLines[oldIdx] === newLines[newIdx]) {
      // Same line
      result.push({ type: 'context', content: oldLines[oldIdx] })
      oldIdx++
      newIdx++
    } else {
      // Check if line was removed
      const newLineIdx = newLines.indexOf(oldLines[oldIdx], newIdx)
      const oldLineIdx = oldLines.indexOf(newLines[newIdx], oldIdx)

      if (newLineIdx === -1 || (oldLineIdx !== -1 && oldLineIdx < newLineIdx)) {
        // Line was removed
        result.push({ type: 'remove', content: oldLines[oldIdx] })
        oldIdx++
      } else {
        // Line was added
        result.push({ type: 'add', content: newLines[newIdx] })
        newIdx++
      }
    }
  }

  return result
}

export function formatDiff(diff: DiffLine[]): string {
  return diff.map(line => {
    const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '
    return `${prefix} ${line.content}`
  }).join('\n')
}
```

**Step 3: Update index**

```typescript
// src/utils/index.ts
export * from './checksum'
export * from './diff'
```

**Step 4: Commit**

```bash
git add src/utils/
git commit -m "feat: add checksum and diff utilities"
```

---

## Phase 5: Local Provider

### Task 5.1: Implement Local Provider

**Files:**
- Create: `src/providers/local.ts`
- Modify: `src/providers/index.ts`

**Step 1: Write local provider**

```typescript
// src/providers/local.ts
import { readdir, readFile } from 'fs/promises'
import { join, basename } from 'path'
import { existsSync } from 'fs'
import type { Provider, SourceConfig, SkillMeta, SkillContent } from '@/types'
import { computeFileChecksum } from '@/utils'

export class LocalProvider implements Provider {
  name = 'local'

  async discover(config: SourceConfig): Promise<SkillMeta[]> {
    const basePath = config.url.replace(/^file:\/\//, '')
    const skillsPath = config.options?.path ? join(basePath, config.options.path as string) : join(basePath, 'skills')

    if (!existsSync(skillsPath)) {
      return []
    }

    const skills: SkillMeta[] = []
    const entries = await readdir(skillsPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillPath = join(skillsPath, entry.name)
      const skillFile = join(skillPath, 'skill.md')

      if (!existsSync(skillFile)) continue

      // Try to read meta.json if exists
      let meta: Partial<SkillMeta> = {}
      const metaFile = join(skillPath, 'meta.json')
      if (existsSync(metaFile)) {
        try {
          const content = await readFile(metaFile, 'utf-8')
          meta = JSON.parse(content)
        } catch {
          // Ignore parse errors
        }
      }

      skills.push({
        id: `${config.name}:${entry.name}`,
        name: meta.name || entry.name,
        description: meta.description,
        author: meta.author,
        targets: meta.targets,
        tags: meta.tags,
        _source: config.name,
        _path: skillFile,
      })
    }

    return skills
  }

  async fetchSkillContent(skill: SkillMeta): Promise<SkillContent> {
    const content = await readFile(skill._path, 'utf-8')
    const checksum = computeFileChecksum(content)

    return {
      id: skill.id,
      content,
      checksum,
    }
  }
}
```

**Step 2: Update provider index**

```typescript
// src/providers/index.ts
export * from './local'
```

**Step 3: Commit**

```bash
git add src/providers/
git commit -m "feat: implement local provider"
```

---

## Phase 6: Built-in Targets

### Task 6.1: Implement Claude Code Target

**Files:**
- Create: `src/targets/base.ts`
- Create: `src/targets/claude-code.ts`
- Modify: `src/targets/index.ts`

**Step 1: Write base target class**

```typescript
// src/targets/base.ts
import { existsSync } from 'fs'
import { readFile, writeFile, unlink, mkdir, readdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { Target, InstallOptions, SkillContent, InstalledSkill } from '@/types'

export abstract class BaseTarget implements Target {
  abstract name: string
  abstract getGlobalPath(): string
  abstract getProjectPath(projectPath: string): string

  protected getInstallPath(options?: InstallOptions): string {
    if (options?.scope === 'project' && options.projectPath) {
      return this.getProjectPath(options.projectPath)
    }
    return this.getGlobalPath()
  }

  async install(skill: SkillContent, options?: InstallOptions): Promise<void> {
    const basePath = this.getInstallPath(options)
    await mkdir(basePath, { recursive: true })

    const fileName = this.getSkillFileName(skill.id)
    const filePath = join(basePath, fileName)

    await writeFile(filePath, skill.content, 'utf-8')
  }

  async uninstall(skillId: string, options?: InstallOptions): Promise<void> {
    const basePath = this.getInstallPath(options)
    const fileName = this.getSkillFileName(skillId)
    const filePath = join(basePath, fileName)

    if (existsSync(filePath)) {
      await unlink(filePath)
    }
  }

  async list(scope: 'global' | 'project', projectPath?: string): Promise<InstalledSkill[]> {
    const basePath = scope === 'project' && projectPath
      ? this.getProjectPath(projectPath)
      : this.getGlobalPath()

    if (!existsSync(basePath)) {
      return []
    }

    const skills: InstalledSkill[] = []
    const entries = await readdir(basePath)

    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue

      const skillId = entry.replace('.md', '').replace(/-/g, ':')
      const filePath = join(basePath, entry)
      const content = await readFile(filePath, 'utf-8')

      skills.push({
        id: skillId,
        source: 'unknown', // Would need to track this separately
        target: this.name,
        scope,
        checksum: '', // Would compute from content
        installedAt: new Date().toISOString(),
        enabled: true, // Would need to track disabled state
      })
    }

    return skills
  }

  async enable(skillId: string, options?: InstallOptions): Promise<void> {
    // Rename .md.disabled to .md
    const basePath = this.getInstallPath(options)
    const disabledPath = join(basePath, `${this.getSkillFileName(skillId)}.disabled`)
    const enabledPath = join(basePath, this.getSkillFileName(skillId))

    if (existsSync(disabledPath)) {
      const { rename } = await import('fs/promises')
      await rename(disabledPath, enabledPath)
    }
  }

  async disable(skillId: string, options?: InstallOptions): Promise<void> {
    // Rename .md to .md.disabled
    const basePath = this.getInstallPath(options)
    const enabledPath = join(basePath, this.getSkillFileName(skillId))
    const disabledPath = join(basePath, `${this.getSkillFileName(skillId)}.disabled`)

    if (existsSync(enabledPath)) {
      const { rename } = await import('fs/promises')
      await rename(enabledPath, disabledPath)
    }
  }

  protected getSkillFileName(skillId: string): string {
    // Convert superpowers:brainstorming to brainstorming.md
    const parts = skillId.split(':')
    return `${parts[parts.length - 1]}.md`
  }
}
```

**Step 2: Write Claude Code target**

```typescript
// src/targets/claude-code.ts
import { join } from 'path'
import { homedir } from 'os'
import { BaseTarget } from './base'

export class ClaudeCodeTarget extends BaseTarget {
  name = 'claude-code'

  getGlobalPath(): string {
    return join(homedir(), '.claude', 'commands')
  }

  getProjectPath(projectPath: string): string {
    return join(projectPath, '.claude', 'commands')
  }
}
```

**Step 3: Update index**

```typescript
// src/targets/index.ts
export * from './base'
export * from './claude-code'
```

**Step 4: Commit**

```bash
git add src/targets/
git commit -m "feat: implement claude-code target"
```

---

### Task 6.2: Implement Cursor Target

**Files:**
- Create: `src/targets/cursor.ts`
- Modify: `src/targets/index.ts`

**Step 1: Write Cursor target**

```typescript
// src/targets/cursor.ts
import { join } from 'path'
import { BaseTarget } from './base'

export class CursorTarget extends BaseTarget {
  name = 'cursor'

  getGlobalPath(): string {
    // Cursor only supports project-level rules
    throw new Error('Cursor only supports project-level skill installation')
  }

  getProjectPath(projectPath: string): string {
    return join(projectPath, '.cursor', 'rules')
  }
}
```

**Step 2: Update index**

```typescript
// src/targets/index.ts
export * from './base'
export * from './claude-code'
export * from './cursor'
```

**Step 3: Commit**

```bash
git add src/targets/
git commit -m "feat: implement cursor target"
```

---

### Task 6.3: Implement OpenCode Target

**Files:**
- Create: `src/targets/opencode.ts`
- Modify: `src/targets/index.ts`

**Step 1: Write OpenCode target**

```typescript
// src/targets/opencode.ts
import { join } from 'path'
import { homedir } from 'os'
import { BaseTarget } from './base'

export class OpenCodeTarget extends BaseTarget {
  name = 'opencode'

  getGlobalPath(): string {
    return join(homedir(), '.config', 'opencode', 'commands')
  }

  getProjectPath(projectPath: string): string {
    return join(projectPath, '.opencode', 'commands')
  }
}
```

**Step 2: Update index**

```typescript
// src/targets/index.ts
export * from './base'
export * from './claude-code'
export * from './cursor'
export * from './opencode'
```

**Step 3: Commit**

```bash
git add src/targets/
git commit -m "feat: implement opencode target"
```

---

## Phase 7: Provider Registry

### Task 7.1: Implement Provider Registry

**Files:**
- Create: `src/providers/registry.ts`
- Modify: `src/providers/index.ts`

**Step 1: Write provider registry**

```typescript
// src/providers/registry.ts
import type { Provider, SourceConfig, SkillMeta, SkillContent } from '@/types'
import { LocalProvider } from './local'

class ProviderRegistry {
  private providers: Map<string, Provider> = new Map()

  constructor() {
    // Register built-in providers
    this.register(new LocalProvider())
  }

  register(provider: Provider): void {
    this.providers.set(provider.name, provider)
  }

  get(name: string): Provider | undefined {
    return this.providers.get(name)
  }

  has(name: string): boolean {
    return this.providers.has(name)
  }

  async discoverAll(configs: SourceConfig[]): Promise<SkillMeta[]> {
    const allSkills: SkillMeta[] = []

    for (const config of configs) {
      if (!config.enabled) continue

      const provider = this.get(config.provider)
      if (!provider) {
        console.warn(`Provider not found: ${config.provider}`)
        continue
      }

      try {
        const skills = await provider.discover(config)
        allSkills.push(...skills)
      } catch (error) {
        console.error(`Failed to discover skills from ${config.name}:`, error)
      }
    }

    return allSkills
  }

  async fetchContent(skill: SkillMeta, config: SourceConfig): Promise<SkillContent> {
    const provider = this.get(config.provider)
    if (!provider) {
      throw new Error(`Provider not found: ${config.provider}`)
    }

    return provider.fetchSkillContent(skill)
  }
}

export const providerRegistry = new ProviderRegistry()
```

**Step 2: Update index**

```typescript
// src/providers/index.ts
export * from './local'
export * from './registry'
```

**Step 3: Commit**

```bash
git add src/providers/
git commit -m "feat: implement provider registry"
```

---

## Phase 8: Target Registry

### Task 8.1: Implement Target Registry

**Files:**
- Create: `src/targets/registry.ts`
- Modify: `src/targets/index.ts`

**Step 1: Write target registry**

```typescript
// src/targets/registry.ts
import type { Target, TargetConfig, SkillContent, InstalledSkill } from '@/types'
import { ClaudeCodeTarget } from './claude-code'
import { CursorTarget } from './cursor'
import { OpenCodeTarget } from './opencode'

class TargetRegistry {
  private targets: Map<string, Target> = new Map()

  constructor() {
    // Register built-in targets
    this.register(new ClaudeCodeTarget())
    this.register(new CursorTarget())
    this.register(new OpenCodeTarget())
  }

  register(target: Target): void {
    this.targets.set(target.name, target)
  }

  get(name: string): Target | undefined {
    return this.targets.get(name)
  }

  has(name: string): boolean {
    return this.targets.has(name)
  }

  getAll(): Target[] {
    return Array.from(this.targets.values())
  }

  getEnabled(configs: TargetConfig[]): Target[] {
    return configs
      .filter(c => c.enabled)
      .map(c => this.get(c.name))
      .filter((t): t is Target => t !== undefined)
  }

  async installToAll(skill: SkillContent, enabledConfigs: TargetConfig[], scope: 'global' | 'project', projectPath?: string): Promise<void> {
    const targets = this.getEnabled(enabledConfigs)

    await Promise.all(targets.map(target =>
      target.install(skill, { scope, projectPath })
    ))
  }

  async uninstallFromAll(skillId: string, enabledConfigs: TargetConfig[], scope: 'global' | 'project', projectPath?: string): Promise<void> {
    const targets = this.getEnabled(enabledConfigs)

    await Promise.all(targets.map(target =>
      target.uninstall(skillId, { scope, projectPath })
    ))
  }
}

export const targetRegistry = new TargetRegistry()
```

**Step 2: Update index**

```typescript
// src/targets/index.ts
export * from './base'
export * from './claude-code'
export * from './cursor'
export * from './opencode'
export * from './registry'
```

**Step 3: Commit**

```bash
git add src/targets/
git commit -m "feat: implement target registry"
```

---

## Phase 9: CLI Entry

### Task 9.1: Implement Basic CLI

**Files:**
- Modify: `src/cli.ts`

**Step 1: Write CLI entry**

```typescript
// src/cli.ts
#!/usr/bin/env bun
import { loadConfig } from './config'
import { providerRegistry } from './providers'
import { targetRegistry } from './targets'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  console.log('LazySkill v0.1.0')
  console.log('')

  // Load config
  const config = await loadConfig()
  console.log(`Loaded config with ${config.sources.length} sources and ${config.targets.length} targets`)

  // Test: discover skills from local sources
  const localSources = config.sources.filter(s => s.enabled)
  const skills = await providerRegistry.discoverAll(localSources)

  console.log(`\nDiscovered ${skills.length} skills:`)
  for (const skill of skills.slice(0, 5)) {
    console.log(`  - ${skill.id}: ${skill.name}`)
  }

  // Test: list targets
  console.log(`\nAvailable targets:`)
  for (const target of targetRegistry.getAll()) {
    console.log(`  - ${target.name}`)
  }
}

main().catch(console.error)
```

**Step 2: Make executable**

```bash
chmod +x src/cli.ts
```

**Step 3: Test**

```bash
bun run src/cli.ts
```

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: implement basic CLI entry"
```

---

## Phase 10: TUI Foundation

### Task 10.1: Implement Basic TUI Layout

**Files:**
- Create: `src/tui/app.ts`
- Create: `src/tui/components/panel.ts`
- Modify: `src/tui/index.ts`

**Step 1: Create panel component**

```typescript
// src/tui/components/panel.ts
import * as p from '@clack/prompts'

export interface PanelOptions {
  title: string
  items: string[]
  selected: number
  width: number
}

export function renderPanel(options: PanelOptions): string[] {
  const { title, items, selected, width } = options
  const lines: string[] = []

  // Title
  lines.push(`┌─ ${title} ${'─'.repeat(width - title.length - 4)}`)

  // Items
  for (let i = 0; i < items.length; i++) {
    const prefix = i === selected ? '◉' : ' '
    const item = items[i].slice(0, width - 4)
    lines.push(`│ ${prefix} ${item.padEnd(width - 4)}`)
  }

  // Padding
  while (lines.length < 10) {
    lines.push(`│ ${' '.repeat(width - 4)}`)
  }

  lines.push(`└${'─'.repeat(width - 1)}`)

  return lines
}
```

**Step 2: Write main app**

```typescript
// src/tui/app.ts
import * as p from '@clack/prompts'
import { loadConfig } from '../config'
import { providerRegistry } from '../providers'
import { targetRegistry } from '../targets'
import type { SkillMeta, Config } from '../types'

export interface AppState {
  config: Config
  skills: SkillMeta[]
  currentPanel: 'skills' | 'sources' | 'targets'
  selectedIndex: number
  visualMode: boolean
  visualStart: number
  searchQuery: string
  searchMode: boolean
}

export async function runApp(): Promise<void> {
  // Load config and skills
  const config = await loadConfig()
  const skills = await providerRegistry.discoverAll(config.sources)

  const state: AppState = {
    config,
    skills,
    currentPanel: 'skills',
    selectedIndex: 0,
    visualMode: false,
    visualStart: 0,
    searchQuery: '',
    searchMode: false,
  }

  // For now, just display a simple list
  p.intro('LazySkill')

  const skillItems = skills.map(s => ({
    value: s.id,
    label: `${s.name} (${s._source})`
  }))

  const selected = await p.select({
    message: 'Select a skill',
    options: skillItems,
  })

  if (p.isCancel(selected)) {
    p.outro('Goodbye!')
    return
  }

  const skill = skills.find(s => s.id === selected)
  if (skill) {
    console.log(`\nSkill: ${skill.name}`)
    console.log(`Source: ${skill._source}`)
    console.log(`Description: ${skill.description || 'No description'}`)
  }

  p.outro('Done!')
}
```

**Step 3: Update index**

```typescript
// src/tui/index.ts
export * from './app'
```

**Step 4: Update CLI to use TUI**

```typescript
// src/cli.ts
#!/usr/bin/env bun
import { runApp } from './tui'

runApp().catch(console.error)
```

**Step 5: Test**

```bash
bun run src/cli.ts
```

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: implement basic TUI with clack"
```

---

## Next Steps

After completing Phase 10, the foundation is in place. Continue with:

- **Phase 11**: Full TUI with lazygit-style layout
- **Phase 12**: Git Provider implementation
- **Phase 13**: Superpowers Provider implementation
- **Phase 14**: Visual mode and batch operations
- **Phase 15**: Diff display for updates
- **Phase 16**: Search functionality
- **Phase 17**: Build and distribution

Each phase should be broken down into similar bite-sized tasks following TDD principles.
