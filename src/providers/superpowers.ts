// src/providers/superpowers.ts
import { readdir, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'
import type { Provider, SourceConfig, SkillMeta, SkillContent } from '@/types'
import { computeFileChecksum } from '@/utils'

const CACHE_DIR = join(homedir(), '.config', 'lazyskill', 'cache')
const DEFAULT_URL = 'https://github.com/obra/superpowers.git'

export class SuperpowersProvider implements Provider {
  name = 'superpowers'

  async discover(config: SourceConfig): Promise<SkillMeta[]> {
    const cachePath = await this.ensureCached(config)
    // Superpowers uses skills/ at root level
    const skillsPath = join(cachePath, 'skills')

    if (!existsSync(skillsPath)) {
      return []
    }

    const skills: SkillMeta[] = []
    const entries = await readdir(skillsPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillPath = join(skillsPath, entry.name)
      // Superpowers uses SKILL.md (uppercase)
      const skillFile = join(skillPath, 'SKILL.md')

      if (!existsSync(skillFile)) continue

      // Extract metadata from skill content
      let meta: Partial<SkillMeta> = {}
      try {
        const content = await readFile(skillFile, 'utf-8')
        meta = this.parseSkillMetadata(content, entry.name)
      } catch {
        // Fallback to directory name
        meta = { name: entry.name }
      }

      skills.push({
        id: `${config.name}:${entry.name}`,
        name: meta.name || entry.name,
        description: meta.description,
        author: meta.author,
        targets: meta.targets,
        tags: meta.tags,
        _source: config.name,
        _path: skillFile,
      })
    }

    return skills
  }

  async fetchSkillContent(skill: SkillMeta): Promise<SkillContent> {
    const content = await readFile(skill._path, 'utf-8')
    const checksum = computeFileChecksum(content)

    return {
      id: skill.id,
      content,
      checksum,
      sourcePath: skill._path,  // Path to original skill file for symlink
    }
  }

  private parseSkillMetadata(content: string, fallbackName: string): Partial<SkillMeta> {
    const meta: Partial<SkillMeta> = { name: fallbackName }

    // Extract name from first heading
    const nameMatch = content.match(/^#\s+(.+)$/m)
    if (nameMatch) {
      meta.name = nameMatch[1].trim()
    }

    // Extract description from first paragraph after heading
    const descMatch = content.match(/^#\s+.+\n\n(.+?)(?:\n\n|\n#|$)/s)
    if (descMatch) {
      meta.description = descMatch[1].trim().slice(0, 200)
    }

    return meta
  }

  private async ensureCached(config: SourceConfig): Promise<string> {
    const url = config.url || DEFAULT_URL
    const cacheName = 'superpowers'
    const cachePath = join(CACHE_DIR, cacheName)

    if (existsSync(cachePath)) {
      // Cache exists, try to update
      try {
        await this.runGit(cachePath, 'fetch')
        await this.runGit(cachePath, 'reset', '--hard', 'origin/main')
      } catch (error) {
        // If update fails, just use existing cache
        console.warn('Failed to update superpowers cache, using existing')
      }
      return cachePath
    }

    // Clone new
    await mkdir(CACHE_DIR, { recursive: true })
    await this.runGit(CACHE_DIR, 'clone', '--depth', '1', url, cachePath)
    return cachePath
  }

  private async clone(url: string, path: string): Promise<void> {
    await mkdir(CACHE_DIR, { recursive: true })
    await this.runGit(CACHE_DIR, 'clone', '--depth', '1', url, path)
  }

  private async removeDir(path: string): Promise<void> {
    const { rm } = await import('fs/promises')
    await rm(path, { recursive: true, force: true })
  }

  private async runGit(cwd: string, ...args: string[]): Promise<string> {
    const result = await Bun.spawn(['git', ...args], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const text = await new Response(result.stdout).text()

    if (result.exitCode !== 0) {
      throw new Error(`Git command failed: git ${args.join(' ')}`)
    }

    return text
  }
}
