// src/targets/registry.ts
import type { SkillContent, Target, TargetConfig } from '@/types'
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
      .filter((c) => c.enabled)
      .map((c) => this.get(c.name))
      .filter((t): t is Target => t !== undefined)
  }

  async installToAll(
    skill: SkillContent,
    enabledConfigs: TargetConfig[],
    scope: 'global' | 'project',
    projectPath?: string,
  ): Promise<void> {
    const targets = this.getEnabled(enabledConfigs)
    if (scope === 'project') {
      if (!projectPath) {
        throw new Error('projectPath is required for project installs')
      }

      await Promise.all(
        targets.map((target) =>
          target.install(skill, { scope: 'project', projectPath }),
        ),
      )
      return
    }

    await Promise.all(targets.map((target) => target.install(skill, { scope })))
  }

  async uninstallFromAll(
    skillId: string,
    enabledConfigs: TargetConfig[],
    scope: 'global' | 'project',
    projectPath?: string,
  ): Promise<void> {
    const targets = this.getEnabled(enabledConfigs)
    if (scope === 'project') {
      if (!projectPath) {
        throw new Error('projectPath is required for project installs')
      }

      await Promise.all(
        targets.map((target) =>
          target.uninstall(skillId, { scope: 'project', projectPath }),
        ),
      )
      return
    }

    await Promise.all(
      targets.map((target) => target.uninstall(skillId, { scope })),
    )
  }
}

export const targetRegistry = new TargetRegistry()
