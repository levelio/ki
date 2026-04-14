import { afterAll, afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

const tempDirs: string[] = []
const tempCacheDir = await mkdtemp(join(tmpdir(), 'ki-git-cache-'))
tempDirs.push(tempCacheDir)

const { GitProvider } = await import('../../src/providers/git')

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

function createSpawnResult(exitCode: number, stdout = '', stderr = '') {
  return {
    exited: Promise.resolve(exitCode),
    exitCode,
    stdout,
    stderr,
  } as unknown as ReturnType<typeof Bun.spawn>
}

afterEach(() => {
  mock.restore()
})

afterAll(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('GitProvider', () => {
  it('discovers nested skills from the default cache skills directory', async () => {
    const provider = new GitProvider(tempCacheDir)
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
`
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
    const provider = new GitProvider(tempCacheDir)
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
`
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
    const provider = new GitProvider(tempCacheDir)
    const config = {
      name: 'openai',
      provider: 'git',
      url: 'https://github.com/openai/skills.git',
      enabled: true,
      options: {
        skillsPath: ['skills/.curated', 'skills/.system', 'skills/.missing'],
      },
    } as const

    const curatedDir = join(getCachePath(config.url), 'skills', '.curated', 'writing')
    const systemDir = join(getCachePath(config.url), 'skills', '.system', 'review')

    await mkdir(curatedDir, { recursive: true })
    await mkdir(systemDir, { recursive: true })
    await writeFile(
      join(curatedDir, 'SKILL.md'),
      `---
name: Writing
description: Draft content
---
`
    )
    await writeFile(
      join(systemDir, 'SKILL.md'),
      `---
name: Review
description: Inspect changes
---
`
    )

    const skills = await provider.discover(config)

    expect(skills).toHaveLength(2)
    expect(skills.map(skill => skill.id)).toEqual(['openai:writing', 'openai:review'])
    expect(skills.map(skill => skill.name)).toEqual(['Writing', 'Review'])
  })

  it('fetches skill content with checksum and source paths', async () => {
    const provider = new GitProvider(tempCacheDir)
    const skillDir = join(getCachePath('https://github.com/acme/content.git'), 'skills', 'review')
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
    const provider = new GitProvider(tempCacheDir)
    const spawn = spyOn(Bun, 'spawn').mockReturnValue(createSpawnResult(0))
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

    expect(spawn).toHaveBeenCalledTimes(1)
    expect(spawn.mock.calls[0]?.[0]).toEqual([
      'git',
      'clone',
      '--depth',
      '1',
      '-b',
      'develop',
      'https://github.com/acme/clone-only.git',
      getCachePath(config.url),
    ])
    expect(spawn.mock.calls[0]?.[1]).toMatchObject({
      cwd: tempCacheDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })
  })

  it('fetches and resets an existing cache during sync', async () => {
    const provider = new GitProvider(tempCacheDir)
    const config = {
      name: 'remote',
      provider: 'git',
      url: 'https://github.com/acme/existing.git',
      enabled: true,
    } as const
    const cachePath = getCachePath(config.url)
    await mkdir(cachePath, { recursive: true })

    const spawn = spyOn(Bun, 'spawn')
      .mockReturnValueOnce(createSpawnResult(0, 'fetched'))
      .mockReturnValueOnce(createSpawnResult(0, 'reset'))

    await provider.sync(config)

    expect(spawn).toHaveBeenCalledTimes(2)
    expect(spawn.mock.calls[0]?.[0]).toEqual(['git', 'fetch'])
    expect(spawn.mock.calls[0]?.[1]).toMatchObject({ cwd: cachePath })
    expect(spawn.mock.calls[1]?.[0]).toEqual(['git', 'reset', '--hard', 'origin/main'])
    expect(spawn.mock.calls[1]?.[1]).toMatchObject({ cwd: cachePath })
  })

  it('reclones after a failed cache update during sync', async () => {
    const provider = new GitProvider(tempCacheDir)
    const config = {
      name: 'remote',
      provider: 'git',
      url: 'https://github.com/acme/broken.git',
      enabled: true,
    } as const
    const cachePath = getCachePath(config.url)
    await mkdir(cachePath, { recursive: true })
    await writeFile(join(cachePath, 'stale.txt'), 'stale')

    const spawn = spyOn(Bun, 'spawn')
      .mockReturnValueOnce(createSpawnResult(1, '', 'fetch failed'))
      .mockReturnValueOnce(createSpawnResult(0, 'cloned'))

    await provider.sync(config)

    expect(spawn).toHaveBeenCalledTimes(2)
    expect(spawn.mock.calls[0]?.[0]).toEqual(['git', 'fetch'])
    expect(spawn.mock.calls[1]?.[0]).toEqual([
      'git',
      'clone',
      '--depth',
      '1',
      '-b',
      'main',
      'https://github.com/acme/broken.git',
      cachePath,
    ])
    expect(spawn.mock.calls[1]?.[1]).toMatchObject({
      cwd: tempCacheDir,
    })
  })
})
