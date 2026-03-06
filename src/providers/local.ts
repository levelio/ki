// src/providers/local.ts
import { readdir, readFile } from 'fs/promises'
import { join, dirname, basename } from 'path'
import { existsSync } from 'fs'
import type { Provider, SourceConfig, SkillMeta, SkillContent } from '@/types'
import { computeFileChecksum } from '@/utils'

/**
 * Local Provider
 *
 * Supports local directories as skill sources.
 *
 * Configuration options:
 * - skillsPath: Path to skills directory, can be a string or array of strings (default: "skills")
 * - structure: "nested" (each skill in subdirectory) or "flat" (skills as direct files)
 * - skillFile: Name of skill file (default: "SKILL.md")
 *
 * Example config:
 * ```yaml
 * sources:
 *   - name: my-local-skills
 *     provider: local
 *     url: /path/to/skills/repo
 *     options:
 *       skillsPath: skills
 *       structure: nested
 *       skillFile: SKILL.md
 *
 *   - name: multi-dir-local
 *     provider: local
 *     url: /path/to/project
 *     options:
 *       skillsPath:
 *         - skills/team
 *         - skills/personal
 *       structure: nested
 * ```
 */
export class LocalProvider implements Provider {
  name = 'local'

  async discover(config: SourceConfig): Promise<SkillMeta[]> {
    const basePath = config.url.replace(/^file:\/\//, '')
    const options = config.options || {}

    // Get skills directory paths (support array)
    const skillsPaths = this.getSkillsPaths(options, basePath)

    const structure = (options.structure as string) || 'nested'
    const skillFile = (options.skillFile as string) || 'SKILL.md'

    // Discover skills from all paths
    const allSkills: SkillMeta[] = []
    for (const skillsPath of skillsPaths) {
      if (!existsSync(skillsPath)) continue

      const skills = structure === 'flat'
        ? await this.discoverFlat(config, skillsPath, skillFile)
        : await this.discoverNested(config, skillsPath, skillFile)

      allSkills.push(...skills)
    }

    return allSkills
  }

  async fetchSkillContent(skill: SkillMeta): Promise<SkillContent> {
    const content = await readFile(skill._path, 'utf-8')
    const checksum = computeFileChecksum(content)
    const sourceDir = dirname(skill._path)

    return {
      id: skill.id,
      content,
      checksum,
      sourcePath: skill._path,
      sourceDir,
    }
  }

  /**
   * Parse skillsPath option, supporting both string and array formats
   */
  private getSkillsPaths(options: Record<string, unknown>, basePath: string): string[] {
    const { skillsPath, path } = options

    // Support both 'skillsPath' and 'path' for backward compatibility
    const skillDir = skillsPath || path

    if (!skillDir) {
      return [join(basePath, 'skills')]
    }

    if (Array.isArray(skillDir)) {
      return skillDir.map(p => join(basePath, p as string))
    }

    return [join(basePath, skillDir as string)]
  }

  private async discoverNested(
    config: SourceConfig,
    skillsPath: string,
    skillFile: string
  ): Promise<SkillMeta[]> {
    const skills: SkillMeta[] = []
    const entries = await readdir(skillsPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('.')) continue

      const skillDir = join(skillsPath, entry.name)
      const skillFilePath = join(skillDir, skillFile)

      if (!existsSync(skillFilePath)) continue

      const meta = await this.parseSkillMetadata(skillFilePath, entry.name)
      skills.push({
        id: `${config.name}:${entry.name}`,
        name: meta.name || entry.name,
        description: meta.description,
        author: meta.author,
        targets: meta.targets,
        tags: meta.tags,
        _source: config.name,
        _path: skillFilePath,
      })
    }

    return skills
  }

  private async discoverFlat(
    config: SourceConfig,
    skillsPath: string,
    skillFile: string
  ): Promise<SkillMeta[]> {
    const skills: SkillMeta[] = []
    const entries = await readdir(skillsPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (entry.name.startsWith('.')) continue

      // For flat structure, accept .md files
      if (!entry.name.endsWith('.md')) continue

      const skillFilePath = join(skillsPath, entry.name)
      const skillName = entry.name.replace(/\.md$/, '')
      const meta = await this.parseSkillMetadata(skillFilePath, skillName)

      skills.push({
        id: `${config.name}:${skillName}`,
        name: meta.name || skillName,
        description: meta.description,
        author: meta.author,
        targets: meta.targets,
        tags: meta.tags,
        _source: config.name,
        _path: skillFilePath,
      })
    }

    return skills
  }

  private async parseSkillMetadata(filePath: string, fallbackName: string): Promise<Partial<SkillMeta>> {
    const meta: Partial<SkillMeta> = { name: fallbackName }

    try {
      const content = await readFile(filePath, 'utf-8')

      // Extract from YAML frontmatter if present
      if (content.trimStart().startsWith('---')) {
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1]

          const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
          if (nameMatch) meta.name = nameMatch[1].trim()

          const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
          if (descMatch) meta.description = descMatch[1].trim()

          return meta
        }
      }

      // Fallback: extract from first heading
      const nameMatch = content.match(/^#\s+(.+)$/m)
      if (nameMatch) meta.name = nameMatch[1].trim()

      const descMatch = content.match(/^#\s+.+\n\n(.+?)(?:\n\n|\n#|$)/s)
      if (descMatch) meta.description = descMatch[1].trim().slice(0, 200)
    } catch {
      // Ignore errors
    }

    return meta
  }
}
