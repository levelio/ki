// src/targets/claude-code.ts
import { join, basename } from 'path'
import { homedir } from 'os'
import { existsSync, lstatSync, statSync } from 'fs'
import { mkdir, readdir, rm, symlink, unlink, writeFile } from 'fs/promises'
import type { Target, InstallOptions, SkillContent, InstalledSkill } from '@/types'

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
    const basePath = options?.scope === 'project' && options.projectPath
      ? this.getProjectPath(options.projectPath)
      : this.getGlobalPath()

    // Each skill is a directory with SKILL.md inside
    const skillName = this.getSkillName(skill.id)
    const skillDir = join(basePath, skillName)

    await mkdir(skillDir, { recursive: true })

    // Write SKILL.md with frontmatter
    const skillContent = this.toSkillFormat(skill)
    const skillFile = join(skillDir, 'SKILL.md')
    await this.writeFileOrSymlink(skillFile, skillContent, skill.sourcePath)
  }

  async uninstall(skillId: string, options?: InstallOptions): Promise<void> {
    const basePath = options?.scope === 'project' && options.projectPath
      ? this.getProjectPath(options.projectPath)
      : this.getGlobalPath()

    const skillName = this.getSkillName(skillId)
    const skillDir = join(basePath, skillName)

    if (existsSync(skillDir)) {
      await rm(skillDir, { recursive: true, force: true })
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
    const entries = await readdir(basePath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.endsWith('.disabled')) continue

      const skillFile = join(basePath, entry.name, 'SKILL.md')
      if (!existsSync(skillFile)) continue

      const skillId = entry.name
      skills.push({
        id: skillId,
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
    const basePath = options?.scope === 'project' && options.projectPath
      ? this.getProjectPath(options.projectPath)
      : this.getGlobalPath()

    const skillName = this.getSkillName(skillId)
    const disabledDir = join(basePath, `${skillName}.disabled`)
    const enabledDir = join(basePath, skillName)

    if (existsSync(disabledDir)) {
      const { rename } = await import('fs/promises')
      await rename(disabledDir, enabledDir)
    }
  }

  async disable(skillId: string, options?: InstallOptions): Promise<void> {
    const basePath = options?.scope === 'project' && options.projectPath
      ? this.getProjectPath(options.projectPath)
      : this.getGlobalPath()

    const skillName = this.getSkillName(skillId)
    const enabledDir = join(basePath, skillName)
    const disabledDir = join(basePath, `${skillName}.disabled`)

    if (existsSync(enabledDir)) {
      const { rename } = await import('fs/promises')
      await rename(enabledDir, disabledDir)
    }
  }

  protected getSkillName(skillId: string): string {
    // Extract skill name from id (last part after colon)
    const parts = skillId.split(':')
    return parts[parts.length - 1]
  }

  protected toSkillFormat(skill: SkillContent): string {
    const skillName = this.getSkillName(skill.id)

    // Check if content already has frontmatter
    if (skill.content.trimStart().startsWith('---')) {
      // Already has frontmatter, use as-is
      return skill.content
    }

    // Add frontmatter for Claude Code skills
    return `---
name: ${skillName}
description: Installed from ${skill.id}
---

${skill.content}`
  }

  /**
   * Write file or create symlink based on platform and source availability
   */
  protected async writeFileOrSymlink(
    targetPath: string,
    content: string,
    sourcePath?: string
  ): Promise<void> {
    // If source path exists and is a file, try to create symlink
    if (sourcePath && existsSync(sourcePath)) {
      try {
        // Try to create symlink
        await this.createSymlink(sourcePath, targetPath)
        return
      } catch (error) {
        // Symlink failed (e.g., Windows without admin), fall back to copy
        console.warn(`Symlink failed, falling back to copy: ${error}`)
      }
    }

    // Fall back to writing file content
    await writeFile(targetPath, content, 'utf-8')
  }

  /**
   * Create symlink with cross-platform support
   */
  protected async createSymlink(sourcePath: string, targetPath: string): Promise<void> {
    // Remove existing file/link first
    if (existsSync(targetPath)) {
      await unlink(targetPath)
    }

    // Ensure target directory exists
    const targetDir = join(targetPath, '..')
    await mkdir(targetDir, { recursive: true })

    // On Windows, use junction for directory symlinks (doesn't require admin)
    // For files, use regular symlink (requires admin on Windows)
    if (isWindows()) {
      // On Windows, for file symlinks we junction type
      // This allows creating symlinks without admin privileges
      await symlink(sourcePath, targetPath, 'junction')
    } else {
      // On Unix/macOS, use regular symlink
      await symlink(sourcePath, targetPath)
    }
  }
}
