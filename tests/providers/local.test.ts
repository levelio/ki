import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { LocalProvider } from '../../src/providers/local'

const tempDirs: string[] = []

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('LocalProvider', () => {
  it('discovers nested skills and reads frontmatter metadata', async () => {
    const root = await makeTempDir('ki-local-nested-')
    const skillDir = join(root, 'skills', 'brainstorming')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---
name: Brainstorming
description: Generate ideas
---

# Brainstorming
`
    )

    const provider = new LocalProvider()
    const skills = await provider.discover({
      name: 'local',
      provider: 'local',
      url: root,
      enabled: true,
    })

    expect(skills).toEqual([
      {
        id: 'local:brainstorming',
        name: 'Brainstorming',
        description: 'Generate ideas',
        author: undefined,
        targets: undefined,
        tags: undefined,
        _source: 'local',
        _path: join(skillDir, 'SKILL.md'),
      },
    ])
  })

  it('discovers flat skills and falls back to heading metadata', async () => {
    const root = await makeTempDir('ki-local-flat-')
    const skillsDir = join(root, 'docs')
    await mkdir(skillsDir, { recursive: true })
    await writeFile(
      join(skillsDir, 'debugging.md'),
      `# Debugging

Find and isolate failures quickly.
`
    )

    const provider = new LocalProvider()
    const skills = await provider.discover({
      name: 'local',
      provider: 'local',
      url: root,
      enabled: true,
      options: {
        skillsPath: 'docs',
        structure: 'flat',
      },
    })

    expect(skills).toEqual([
      {
        id: 'local:debugging',
        name: 'Debugging',
        description: 'Find and isolate failures quickly.',
        author: undefined,
        targets: undefined,
        tags: undefined,
        _source: 'local',
        _path: join(skillsDir, 'debugging.md'),
      },
    ])
  })

  it('fetches skill content with checksum and source paths', async () => {
    const root = await makeTempDir('ki-local-fetch-')
    const skillDir = join(root, 'skills', 'review')
    const skillFile = join(skillDir, 'SKILL.md')
    await mkdir(skillDir, { recursive: true })
    await writeFile(skillFile, '# Review\n\nInspect carefully.')

    const provider = new LocalProvider()
    const content = await provider.fetchSkillContent({
      id: 'local:review',
      name: 'review',
      _source: 'local',
      _path: skillFile,
    })

    expect(content.id).toBe('local:review')
    expect(content.content).toBe('# Review\n\nInspect carefully.')
    expect(content.checksum).toMatch(/^sha256:/)
    expect(content.sourcePath).toBe(skillFile)
    expect(content.sourceDir).toBe(skillDir)
  })
})
