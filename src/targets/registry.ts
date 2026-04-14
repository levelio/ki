// src/targets/registry.ts
import type { Target, TargetConfig, SkillContent } from '@/types'
import { ClaudeCodeTarget } from './claude-code'
import { CodexTarget } from './codex'
import { CursorTarget } from './cursor'

export class TargetRegistry {
  private targets: Map<string, Target> = new Map()

  constructor() {
    // Register built-in targets
    this.register(new ClaudeCodeTarget())
    this.register(new CodexTarget())
    this.register(new CursorTarget())
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

  async installToAll(
    skill: SkillContent,
    enabledConfigs: TargetConfig[],
    scope: 'global' | 'project',
    projectPath?: string
  ): Promise<void> {
    const targets = this.getEnabled(enabledConfigs)
    const installOptions = scope === 'project'
      ? { scope, projectPath: projectPath! }
      : { scope }

    await Promise.all(targets.map(target =>
      target.install(skill, installOptions)
    ))
  }

  async uninstallFromAll(
    skillId: string,
    enabledConfigs: TargetConfig[],
    scope: 'global' | 'project',
    projectPath?: string
  ): Promise<void> {
    const targets = this.getEnabled(enabledConfigs)
    const installOptions = scope === 'project'
      ? { scope, projectPath: projectPath! }
      : { scope }

    await Promise.all(targets.map(target =>
      target.uninstall(skillId, installOptions)
    ))
  }
}

export const targetRegistry = new TargetRegistry()
