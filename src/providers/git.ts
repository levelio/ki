import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
// src/providers/git.ts
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Provider, SkillContent, SkillMeta, SourceConfig } from '@/types'
import { computeFileChecksum } from '@/utils'

/**
 * Universal Git Provider
 *
 * Supports any git repository as a skill source through configuration.
 *
 * Configuration options:
 * - skillsPath: Path to skills directory, can be a string or array of strings (default: "skills")
 * - structure: "nested" (each skill in subdirectory) or "flat" (skills as direct files)
 * - skillFile: Name of skill file (default: "SKILL.md")
 * - branch: Git branch to use (default: "main")
 *
 * Example config:
 * ```yaml
 * sources:
 *   - name: superpowers
 *     provider: git
 *     url: https://github.com/obra/superpowers.git
 *     options:
 *       skillsPath: skills
 *       structure: nested
 *       skillFile: SKILL.md
 *
 *   - name: openai-skills
 *     provider: git
 *     url: https://github.com/openai/skills.git
 *     options:
 *       skillsPath:
 *         - skills/.curated
 *         - skills/.system
 *       structure: nested
 *       skillFile: SKILL.md
 * ```
 */
export class GitProvider implements Provider {
  name = 'git'

  constructor(
    private readonly cacheDir = join(homedir(), '.config', 'ki', 'cache'),
  ) {}

  async discover(config: SourceConfig): Promise<SkillMeta[]> {
    const cachePath = this.getCachePath(config)
    const options = config.options || {}

    // Get skills directory paths (support array)
    const skillsPaths = this.getSkillsPaths(options, cachePath)

    const structure = (options.structure as string) || 'nested'
    const skillFile = (options.skillFile as string) || 'SKILL.md'

    // Discover skills from all paths
    const allSkills: SkillMeta[] = []
    for (const skillsPath of skillsPaths) {
      if (!existsSync(skillsPath)) continue

      const skills =
        structure === 'flat'
          ? await this.discoverFlat(config, skillsPath, skillFile)
          : await this.discoverNested(config, skillsPath, skillFile)

      allSkills.push(...skills)
    }

    return allSkills
  }

  /**
   * Parse skillsPath option, supporting both string and array formats
   */
  private getSkillsPaths(
    options: Record<string, unknown>,
    cachePath: string,
  ): string[] {
    const { skillsPath } = options

    if (!skillsPath) {
      return [join(cachePath, 'skills')]
    }

    if (Array.isArray(skillsPath)) {
      return skillsPath.map((p) => join(cachePath, p as string))
    }

    return [join(cachePath, skillsPath as string)]
  }

  /**
   * Sync the source - clone if not exists, or fetch + reset if exists
   */
  async sync(config: SourceConfig): Promise<void> {
    await this.ensureCached(config)
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

  private async discoverNested(
    config: SourceConfig,
    skillsPath: string,
    skillFile: string,
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
    skillFile: string,
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

  private async parseSkillMetadata(
    filePath: string,
    fallbackName: string,
  ): Promise<Partial<SkillMeta>> {
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

  private getCachePath(config: SourceConfig): string {
    const cacheName = this.getCacheName(config.url)
    return join(this.cacheDir, cacheName)
  }

  private async ensureCached(config: SourceConfig): Promise<void> {
    const url = config.url
    const branch = (config.options?.branch as string) || 'main'
    const cachePath = this.getCachePath(config)

    if (existsSync(cachePath)) {
      try {
        await this.runGit(cachePath, 'fetch')
        await this.runGit(cachePath, 'reset', '--hard', `origin/${branch}`)
      } catch {
        await this.removeDir(cachePath)
        await this.clone(url, cachePath, branch)
      }
    } else {
      await this.clone(url, cachePath, branch)
    }
  }

  private async clone(
    url: string,
    path: string,
    branch: string,
  ): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true })
    await this.runGit(
      this.cacheDir,
      'clone',
      '--depth',
      '1',
      '-b',
      branch,
      url,
      path,
    )
  }

  private async removeDir(path: string): Promise<void> {
    const { rm } = await import('node:fs/promises')
    await rm(path, { recursive: true, force: true })
  }

  private async runGit(cwd: string, ...args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      child.on('error', (error) => {
        reject(error)
      })

      child.on('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(`Git command failed: git ${args.join(' ')}\n${stderr}`),
          )
          return
        }

        resolve(stdout)
      })
    })
  }

  private getCacheName(url: string): string {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/\.git$/, '')
      .replace(/[\/:]/g, '-')
      .replace(/^-/, '')
  }
}
