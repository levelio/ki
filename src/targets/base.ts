// src/targets/base.ts
import { existsSync } from 'node:fs'
import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'
import type {
  InstallOptions,
  InstalledSkill,
  SkillContent,
  Target,
} from '@/types'

export abstract class BaseTarget implements Target {
  abstract name: string
  abstract getGlobalPath(): string
  abstract getProjectPath(projectPath: string): string

  resolveInstalledId(skillId: string): string {
    return this.getSkillFileName(skillId).replace(/\.md$/, '')
  }

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

  async isInstalled(
    skillId: string,
    options?: InstallOptions,
  ): Promise<boolean> {
    const basePath = this.getInstallPath(options)
    const fileName = this.getSkillFileName(skillId)
    const filePath = join(basePath, fileName)

    return existsSync(filePath)
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
    const entries = await readdir(basePath)

    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue
      if (entry.endsWith('.md.disabled')) continue

      const skillId = entry.replace('.md', '').replace(/-/g, ':')
      const filePath = join(basePath, entry)
      const content = await readFile(filePath, 'utf-8')

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
    const basePath = this.getInstallPath(options)
    const disabledPath = join(
      basePath,
      `${this.getSkillFileName(skillId)}.disabled`,
    )
    const enabledPath = join(basePath, this.getSkillFileName(skillId))

    if (existsSync(disabledPath)) {
      await rename(disabledPath, enabledPath)
    }
  }

  async disable(skillId: string, options?: InstallOptions): Promise<void> {
    const basePath = this.getInstallPath(options)
    const enabledPath = join(basePath, this.getSkillFileName(skillId))
    const disabledPath = join(
      basePath,
      `${this.getSkillFileName(skillId)}.disabled`,
    )

    if (existsSync(enabledPath)) {
      await rename(enabledPath, disabledPath)
    }
  }

  protected getSkillFileName(skillId: string): string {
    const parts = skillId.split(':')
    return `${parts[parts.length - 1]}.md`
  }
}
