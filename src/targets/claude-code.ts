// src/targets/claude-code.ts
import { join, basename } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'
import { readFile, writeFile, unlink, mkdir, readdir, rm } from 'fs/promises'
import type { Target, InstallOptions, SkillContent, InstalledSkill } from '@/types'

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
    // Skills are always enabled if the directory exists
    // Could implement by renaming .disabled suffix if needed
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
}
