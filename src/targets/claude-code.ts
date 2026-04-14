import { existsSync, lstatSync } from 'node:fs'
import {
  mkdir,
  readdir,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { homedir } from 'node:os'
// src/targets/claude-code.ts
import { basename, join } from 'node:path'
import type {
  InstallOptions,
  InstalledSkill,
  SkillContent,
  Target,
} from '@/types'

import { isWindows } from '@/utils/platform'

export class ClaudeCodeTarget implements Target {
  name = 'claude-code'

  getGlobalPath(): string {
    return join(homedir(), '.claude', 'skills')
  }

  getProjectPath(projectPath: string): string {
    return join(projectPath, '.claude', 'skills')
  }

  async install(skill: SkillContent, options?: InstallOptions): Promise<void> {
    const basePath =
      options?.scope === 'project' && options.projectPath
        ? this.getProjectPath(options.projectPath)
        : this.getGlobalPath()

    const skillName = this.getSkillName(skill.id)
    const targetDir = join(basePath, skillName)

    // If source directory exists, create symlink to the whole directory
    if (skill.sourceDir && existsSync(skill.sourceDir)) {
      await this.createDirSymlink(skill.sourceDir, targetDir)
    } else {
      // Fallback: create directory with SKILL.md
      await mkdir(targetDir, { recursive: true })
      const skillContent = this.toSkillFormat(skill)
      await writeFile(join(targetDir, 'SKILL.md'), skillContent, 'utf-8')
    }
  }

  async uninstall(skillId: string, options?: InstallOptions): Promise<void> {
    const basePath =
      options?.scope === 'project' && options.projectPath
        ? this.getProjectPath(options.projectPath)
        : this.getGlobalPath()

    const skillName = this.getSkillName(skillId)
    const skillDir = join(basePath, skillName)

    if (existsSync(skillDir)) {
      // Check if it's a symlink
      const stats = lstatSync(skillDir)
      if (stats.isSymbolicLink()) {
        await unlink(skillDir)
      } else {
        await rm(skillDir, { recursive: true, force: true })
      }
    }
  }

  async list(
    scope: 'global' | 'project',
    projectPath?: string,
  ): Promise<InstalledSkill[]> {
    const basePath =
      scope === 'project' && projectPath
        ? this.getProjectPath(projectPath)
        : this.getGlobalPath()

    if (!existsSync(basePath)) {
      return []
    }

    const skills: InstalledSkill[] = []
    const entries = await readdir(basePath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      if (entry.name.endsWith('.disabled')) continue

      const skillPath = join(basePath, entry.name)
      const skillFile = join(skillPath, 'SKILL.md')
      if (!existsSync(skillFile)) continue

      skills.push({
        id: entry.name,
        source: 'unknown',
        target: this.name,
        scope,
        checksum: '',
        installedAt: new Date().toISOString(),
        enabled: true,
      })
    }

    return skills
  }

  async enable(skillId: string, options?: InstallOptions): Promise<void> {
    const basePath =
      options?.scope === 'project' && options.projectPath
        ? this.getProjectPath(options.projectPath)
        : this.getGlobalPath()

    const skillName = this.getSkillName(skillId)
    const disabledPath = join(basePath, `${skillName}.disabled`)
    const enabledPath = join(basePath, skillName)

    if (existsSync(disabledPath)) {
      await rename(disabledPath, enabledPath)
    }
  }

  async disable(skillId: string, options?: InstallOptions): Promise<void> {
    const basePath =
      options?.scope === 'project' && options.projectPath
        ? this.getProjectPath(options.projectPath)
        : this.getGlobalPath()

    const skillName = this.getSkillName(skillId)
    const enabledPath = join(basePath, skillName)
    const disabledPath = join(basePath, `${skillName}.disabled`)

    if (existsSync(enabledPath)) {
      await rename(enabledPath, disabledPath)
    }
  }

  protected getSkillName(skillId: string): string {
    const parts = skillId.split(':')
    return parts[parts.length - 1]
  }

  protected toSkillFormat(skill: SkillContent): string {
    const skillName = this.getSkillName(skill.id)

    if (skill.content.trimStart().startsWith('---')) {
      return skill.content
    }

    return `---
name: ${skillName}
description: Installed from ${skill.id}
---

${skill.content}`
  }

  /**
   * Create symlink to a directory with cross-platform support
   */
  protected async createDirSymlink(
    sourceDir: string,
    targetDir: string,
  ): Promise<void> {
    // Remove existing directory/link first
    if (existsSync(targetDir)) {
      const stats = lstatSync(targetDir)
      if (stats.isSymbolicLink()) {
        await unlink(targetDir)
      } else {
        await rm(targetDir, { recursive: true, force: true })
      }
    }

    // Ensure parent directory exists
    await mkdir(join(targetDir, '..'), { recursive: true })

    // Create symlink to the directory
    if (isWindows()) {
      // On Windows, use junction for directory symlinks (doesn't require admin)
      await symlink(sourceDir, targetDir, 'junction')
    } else {
      // On Unix/macOS, use regular symlink
      await symlink(sourceDir, targetDir)
    }
  }
}
