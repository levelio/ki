// src/providers/superpowers.ts
import { readdir, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'
import type { Provider, SourceConfig, SkillMeta, SkillContent } from '@/types'
import { computeFileChecksum } from '@/utils'

const CACHE_DIR = join(homedir(), '.config', 'lazyskill', 'cache')
const DEFAULT_URL = 'https://github.com/sst/superpowers-marketplace.git'

export class SuperpowersProvider implements Provider {
  name = 'superpowers'

  async discover(config: SourceConfig): Promise<SkillMeta[]> {
    const cachePath = await this.ensureCached(config)
    const version = await this.getVersion(cachePath, config)
    const skillsPath = join(cachePath, 'superpowers', version, 'skills')

    if (!existsSync(skillsPath)) {
      return []
    }

    const skills: SkillMeta[] = []
    const entries = await readdir(skillsPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillPath = join(skillsPath, entry.name)
      const skillFile = join(skillPath, 'skill.md')

      if (!existsSync(skillFile)) continue

      let meta: Partial<SkillMeta> = {}
      const metaFile = join(skillPath, 'meta.json')
      if (existsSync(metaFile)) {
        try {
          const content = await readFile(metaFile, 'utf-8')
          meta = JSON.parse(content)
        } catch {
          // Ignore parse errors
        }
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
    }
  }

  private async getVersion(cachePath: string, config: SourceConfig): Promise<string> {
    // If version is specified, use it
    if (config.options?.version) {
      return config.options.version as string
    }

    // Otherwise, find the latest version
    const superpowersPath = join(cachePath, 'superpowers')
    if (!existsSync(superpowersPath)) {
      throw new Error('Superpowers directory not found in cache')
    }

    const versions = await readdir(superpowersPath)
    // Sort versions in descending order (assuming semver-like format)
    const sortedVersions = versions
      .filter(v => /^\d+\.\d+\.\d+/.test(v))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

    if (sortedVersions.length === 0) {
      throw new Error('No versions found in superpowers directory')
    }

    return sortedVersions[0]
  }

  private async ensureCached(config: SourceConfig): Promise<string> {
    const url = config.url || DEFAULT_URL
    const cacheName = 'superpowers-marketplace'
    const cachePath = join(CACHE_DIR, cacheName)

    if (existsSync(cachePath)) {
      try {
        await this.runGit(cachePath, 'fetch')
        await this.runGit(cachePath, 'reset', '--hard', 'origin/main')
      } catch {
        await this.removeDir(cachePath)
        await this.clone(url, cachePath)
      }
    } else {
      await this.clone(url, cachePath)
    }

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
