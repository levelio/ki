// src/targets/cursor.ts
import { join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'
import { writeFile, unlink, mkdir, readdir, rename, rm } from 'fs/promises'
import type { Target, InstallOptions, SkillContent, InstalledSkill } from '@/types'

export class CursorTarget implements Target {
  name = 'cursor'

  getGlobalPath(): string {
    return join(homedir(), '.cursor', 'skills')
  }

  getProjectPath(projectPath: string): string {
    return join(projectPath, '.cursor', 'skills')
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
    await writeFile(join(skillDir, 'SKILL.md'), skillContent, 'utf-8')
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
      await rename(enabledDir, disabledDir)
    }
  }

  protected getSkillName(skillId: string): string {
    // Extract skill name from id (last part after colon)
    const parts = skillId.split(':')
    // Cursor skill name: lowercase letters, numbers, and hyphens only
    return parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9-]/g, '-')
  }

  protected toSkillFormat(skill: SkillContent): string {
    const skillName = this.getSkillName(skill.id)

    // Check if content already has frontmatter
    if (skill.content.trimStart().startsWith('---')) {
      // Already has frontmatter, use as-is
      return skill.content
    }

    // Add frontmatter for Cursor skills
    return `---
name: ${skillName}
description: Installed from ${skill.id}
---

${skill.content}`
  }
}
