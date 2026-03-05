// src/providers/git.ts
import { readdir, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'
import type { Provider, SourceConfig, SkillMeta, SkillContent } from '@/types'
import { computeFileChecksum } from '@/utils'

const CACHE_DIR = join(homedir(), '.config', 'lazyskill', 'cache')

export class GitProvider implements Provider {
  name = 'git'

  async discover(config: SourceConfig): Promise<SkillMeta[]> {
    const cachePath = await this.ensureCached(config)
    const skillsPath = config.options?.path
      ? join(cachePath, config.options.path as string)
      : join(cachePath, 'skills')

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

  private async ensureCached(config: SourceConfig): Promise<string> {
    const url = config.url
    const branch = (config.options?.branch as string) || 'main'
    const cacheName = this.getCacheName(url)
    const cachePath = join(CACHE_DIR, cacheName)

    if (existsSync(cachePath)) {
      // Pull latest changes
      try {
        await this.runGit(cachePath, 'fetch')
        await this.runGit(cachePath, 'reset', '--hard', `origin/${branch}`)
      } catch {
        // If pull fails, remove and re-clone
        await this.removeDir(cachePath)
        await this.clone(url, cachePath, branch)
      }
    } else {
      await this.clone(url, cachePath, branch)
    }

    return cachePath
  }

  private async clone(url: string, path: string, branch: string): Promise<void> {
    await mkdir(CACHE_DIR, { recursive: true })
    await this.runGit(CACHE_DIR, 'clone', '--depth', '1', '-b', branch, url, path)
  }

  private async removeDir(path: string): Promise<void> {
    const { rm } = await import('fs/promises')
    await rm(path, { recursive: true, force: true })
  }

  private async runGit(cwd: string, ...args: string[]): Promise<string> {
    const result = Bun.spawn(['git', ...args], {
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

  private getCacheName(url: string): string {
    // Convert URL to safe directory name
    return url
      .replace(/^https?:\/\//, '')
      .replace(/\.git$/, '')
      .replace(/[\/:]/g, '-')
      .replace(/^-/, '')
  }
}
