// src/providers/local.ts
import { readdir, readFile } from 'fs/promises'
import { join, basename } from 'path'
import { existsSync } from 'fs'
import type { Provider, SourceConfig, SkillMeta, SkillContent } from '@/types'
import { computeFileChecksum } from '@/utils'

export class LocalProvider implements Provider {
  name = 'local'

  async discover(config: SourceConfig): Promise<SkillMeta[]> {
    const basePath = config.url.replace(/^file:\/\//, '')
    const skillsPath = config.options?.path
      ? join(basePath, config.options.path as string)
      : join(basePath, 'skills')

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

      // Try to read meta.json if exists
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
}
