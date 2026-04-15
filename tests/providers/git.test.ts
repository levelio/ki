import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

const tempDirs: string[] = []
const tempCacheDir = await mkdtemp(join(tmpdir(), 'ki-git-cache-'))
tempDirs.push(tempCacheDir)

function getCacheName(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/[/:]/g, '-')
    .replace(/^-/, '')
}

function getCachePath(url: string): string {
  return join(tempCacheDir, getCacheName(url))
}

async function makeSkillFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function createProvider() {
  const { GitProvider } = await import('../../src/providers/git')
  return new GitProvider(tempCacheDir)
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

describe('GitProvider', () => {
  it('discovers nested skills from the default cache skills directory', async () => {
    const provider = await createProvider()
    const config = {
      name: 'remote',
      provider: 'git',
      url: 'https://github.com/acme/skills.git',
      enabled: true,
    } as const

    const skillDir = join(getCachePath(config.url), 'skills', 'brainstorming')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---
name: Brainstorming
description: Generate ideas
---

# Brainstorming
`,
    )

    const skills = await provider.discover(config)

    expect(skills).toEqual([
      {
        id: 'remote:brainstorming',
        name: 'Brainstorming',
        description: 'Generate ideas',
        author: undefined,
        targets: undefined,
        tags: undefined,
        _source: 'remote',
        _path: join(skillDir, 'SKILL.md'),
      },
    ])
  })

  it('discovers flat skills and falls back to heading metadata', async () => {
    const provider = await createProvider()
    const config = {
      name: 'docs',
      provider: 'git',
      url: 'https://github.com/acme/docs.git',
      enabled: true,
      options: {
        skillsPath: 'prompts',
        structure: 'flat',
      },
    } as const

    const skillFile = join(getCachePath(config.url), 'prompts', 'debugging.md')
    await makeSkillFile(
      skillFile,
      `# Debugging

Find and isolate failures quickly.
`,
    )

    const skills = await provider.discover(config)

    expect(skills).toEqual([
      {
        id: 'docs:debugging',
        name: 'Debugging',
        description: 'Find and isolate failures quickly.',
        author: undefined,
        targets: undefined,
        tags: undefined,
        _source: 'docs',
        _path: skillFile,
      },
    ])
  })

  it('merges skills discovered from multiple configured skillsPath directories', async () => {
    const provider = await createProvider()
    const config = {
      name: 'openai',
      provider: 'git',
      url: 'https://github.com/openai/skills.git',
      enabled: true,
      options: {
        skillsPath: ['skills/.curated', 'skills/.system', 'skills/.missing'],
      },
    } as const

    const curatedDir = join(
      getCachePath(config.url),
      'skills',
      '.curated',
      'writing',
    )
    const systemDir = join(
      getCachePath(config.url),
      'skills',
      '.system',
      'review',
    )

    await mkdir(curatedDir, { recursive: true })
    await mkdir(systemDir, { recursive: true })
    await writeFile(
      join(curatedDir, 'SKILL.md'),
      `---
name: Writing
description: Draft content
---
`,
    )
    await writeFile(
      join(systemDir, 'SKILL.md'),
      `---
name: Review
description: Inspect changes
---
`,
    )

    const skills = await provider.discover(config)

    expect(skills).toHaveLength(2)
    expect(skills.map((skill) => skill.id)).toEqual([
      'openai:writing',
      'openai:review',
    ])
    expect(skills.map((skill) => skill.name)).toEqual(['Writing', 'Review'])
  })

  it('fetches skill content with checksum and source paths', async () => {
    const provider = await createProvider()
    const skillDir = join(
      getCachePath('https://github.com/acme/content.git'),
      'skills',
      'review',
    )
    const skillFile = join(skillDir, 'SKILL.md')
    await mkdir(skillDir, { recursive: true })
    await writeFile(skillFile, '# Review\n\nInspect carefully.')

    const content = await provider.fetchSkillContent({
      id: 'remote:review',
      name: 'review',
      _source: 'remote',
      _path: skillFile,
    })

    expect(content.id).toBe('remote:review')
    expect(content.content).toBe('# Review\n\nInspect carefully.')
    expect(content.checksum).toMatch(/^sha256:/)
    expect(content.sourcePath).toBe(skillFile)
    expect(content.sourceDir).toBe(skillDir)
  })

  it('clones into the cache when sync runs for an uncached source', async () => {
    const provider = await createProvider()
    const runGit = vi
      .spyOn(provider as never, 'runGit' as never)
      .mockResolvedValue('')
    const config = {
      name: 'remote',
      provider: 'git',
      url: 'https://github.com/acme/clone-only.git',
      enabled: true,
      options: {
        branch: 'develop',
      },
    } as const

    await provider.sync(config)

    expect(runGit).toHaveBeenCalledTimes(1)
    expect(runGit.mock.calls[0]).toEqual([
      tempCacheDir,
      'clone',
      '--depth',
      '1',
      '-b',
      'develop',
      'https://github.com/acme/clone-only.git',
      getCachePath(config.url),
    ])
  })

  it('fetches and resets an existing cache during sync', async () => {
    const provider = await createProvider()
    const config = {
      name: 'remote',
      provider: 'git',
      url: 'https://github.com/acme/existing.git',
      enabled: true,
    } as const
    const cachePath = getCachePath(config.url)
    await mkdir(cachePath, { recursive: true })

    const runGit = vi
      .spyOn(provider as never, 'runGit' as never)
      .mockResolvedValue('')

    await provider.sync(config)

    expect(runGit).toHaveBeenCalledTimes(2)
    expect(runGit.mock.calls[0]).toEqual([cachePath, 'fetch'])
    expect(runGit.mock.calls[1]).toEqual([
      cachePath,
      'reset',
      '--hard',
      'origin/main',
    ])
  })

  it('reclones after a failed cache update during sync', async () => {
    const provider = await createProvider()
    const config = {
      name: 'remote',
      provider: 'git',
      url: 'https://github.com/acme/broken.git',
      enabled: true,
    } as const
    const cachePath = getCachePath(config.url)
    await mkdir(cachePath, { recursive: true })
    await writeFile(join(cachePath, 'stale.txt'), 'stale')

    const runGit = vi
      .spyOn(provider as never, 'runGit' as never)
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue('')

    await provider.sync(config)

    expect(runGit).toHaveBeenCalledTimes(2)
    expect(runGit.mock.calls[0]).toEqual([cachePath, 'fetch'])
    expect(runGit.mock.calls[1]).toEqual([
      tempCacheDir,
      'clone',
      '--depth',
      '1',
      '-b',
      'main',
      'https://github.com/acme/broken.git',
      cachePath,
    ])
  })
})
