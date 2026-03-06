// src/targets/cursor.ts
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile, writeFile, unlink, mkdir, readdir, rename } from 'fs/promises'
import type { Target, InstallOptions, SkillContent, InstalledSkill } from '@/types'

export class CursorTarget implements Target {
  name = 'cursor'

  getGlobalPath(): string {
    // Cursor only supports project-level rules
    // User Rules are stored in Cursor's internal settings, not filesystem
    throw new Error('Cursor only supports project-level skill installation')
  }

  getProjectPath(projectPath: string): string {
    return join(projectPath, '.cursor', 'rules')
  }

  async install(skill: SkillContent, options?: InstallOptions): Promise<void> {
    if (options?.scope === 'global') {
      throw new Error('Cursor only supports project-level skill installation')
    }

    const basePath = this.getProjectPath(options?.projectPath || '.')
    await mkdir(basePath, { recursive: true })

    const fileName = this.getSkillFileName(skill.id)
    const filePath = join(basePath, fileName)

    // Cursor uses .mdc format with YAML frontmatter
    const mdcContent = this.toMdcFormat(skill)
    await writeFile(filePath, mdcContent, 'utf-8')
  }

  async uninstall(skillId: string, options?: InstallOptions): Promise<void> {
    if (options?.scope === 'global') {
      throw new Error('Cursor only supports project-level skill installation')
    }

    const basePath = this.getProjectPath(options?.projectPath || '.')
    const fileName = this.getSkillFileName(skillId)
    const filePath = join(basePath, fileName)

    if (existsSync(filePath)) {
      await unlink(filePath)
    }
  }

  async list(scope: 'global' | 'project', projectPath?: string): Promise<InstalledSkill[]> {
    if (scope === 'global') {
      return []
    }

    const basePath = this.getProjectPath(projectPath || '.')

    if (!existsSync(basePath)) {
      return []
    }

    const skills: InstalledSkill[] = []
    const entries = await readdir(basePath)

    for (const entry of entries) {
      if (!entry.endsWith('.mdc')) continue
      if (entry.endsWith('.mdc.disabled')) continue

      const skillId = entry.replace('.mdc', '').replace(/-/g, ':')
      const filePath = join(basePath, entry)

      skills.push({
        id: skillId,
        source: 'unknown',
        target: this.name,
        scope: 'project',
        checksum: '',
        installedAt: new Date().toISOString(),
        enabled: true,
      })
    }

    return skills
  }

  async enable(skillId: string, options?: InstallOptions): Promise<void> {
    const basePath = this.getProjectPath(options?.projectPath || '.')
    const disabledPath = join(basePath, `${this.getSkillFileName(skillId)}.disabled`)
    const enabledPath = join(basePath, this.getSkillFileName(skillId))

    if (existsSync(disabledPath)) {
      await rename(disabledPath, enabledPath)
    }
  }

  async disable(skillId: string, options?: InstallOptions): Promise<void> {
    const basePath = this.getProjectPath(options?.projectPath || '.')
    const enabledPath = join(basePath, this.getSkillFileName(skillId))
    const disabledPath = join(basePath, `${this.getSkillFileName(skillId)}.disabled`)

    if (existsSync(enabledPath)) {
      await rename(enabledPath, disabledPath)
    }
  }

  protected getSkillFileName(skillId: string): string {
    const parts = skillId.split(':')
    return `${parts[parts.length - 1]}.mdc`
  }

  protected toMdcFormat(skill: SkillContent): string {
    // Extract skill name from id (last part after colon)
    const parts = skill.id.split(':')
    const skillName = parts[parts.length - 1]

    // Create .mdc format with YAML frontmatter
    // Cursor rules format: alwaysApply: true makes it always active
    return `---
description: Skill: ${skillName}
alwaysApply: true
---

${skill.content}`
  }
}
