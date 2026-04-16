// src/types/target.ts
import type { InstalledSkill, SkillContent } from './skill'

export type InstallOptions =
  | { scope: 'global'; projectPath?: undefined }
  | { scope: 'project'; projectPath: string }

export interface Target {
  name: string
  install(skill: SkillContent, options?: InstallOptions): Promise<void>
  uninstall(skillId: string, options?: InstallOptions): Promise<void>
  isInstalled?(skillId: string, options?: InstallOptions): Promise<boolean>
  resolveInstalledId?(skillId: string): string
  list(
    scope: 'global' | 'project',
    projectPath?: string,
  ): Promise<InstalledSkill[]>
  enable(skillId: string, options?: InstallOptions): Promise<void>
  disable(skillId: string, options?: InstallOptions): Promise<void>
  getGlobalPath(): string
  getProjectPath(projectPath: string): string
}
