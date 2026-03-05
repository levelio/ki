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
