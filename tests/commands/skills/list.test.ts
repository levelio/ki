import { mockModule, resetModuleMocks } from 'test-mocks'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InstalledRecord } from '../../../src/installed'

const mock = vi.fn

const originalLog = console.log

function createSource(name: string, enabled: boolean) {
  return {
    name,
    provider: 'git',
    url: `https://github.com/acme/${name}.git`,
    enabled,
  }
}

function createPromptMocks() {
  return {
    intro: mock(() => {}),
    outro: mock(() => {}),
    note: mock(() => {}),
    spinner: () => ({
      start: mock(() => {}),
      stop: mock(() => {}),
      message: mock(() => {}),
    }),
  }
}

afterEach(() => {
  resetModuleMocks()
  console.log = originalLog
})

describe('skill listing commands', () => {
  it('filters by installed records, source, query, and project scope before rendering', async () => {
    const prompts = createPromptMocks()
    const currentProjectPath = process.cwd()
    const consoleLines: string[] = []
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log
    const installedRecords: InstalledRecord[] = [
      {
        id: 'source:alpha',
        source: 'source',
        targets: ['codex'],
        scope: 'project',
        projectPath: currentProjectPath,
        checksum: 'sha256:1',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
      {
        id: 'source:alpha',
        source: 'source',
        targets: ['cursor'],
        scope: 'project',
        projectPath: '/tmp/other-project',
        checksum: 'sha256:2',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
      {
        id: 'source:beta',
        source: 'source',
        targets: ['claude-code'],
        scope: 'global',
        checksum: 'sha256:3',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
    ]

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../../src/providers', () => ({
      providerRegistry: {
        discoverAll: mock(async () => [
          {
            id: 'source:alpha',
            name: 'Alpha',
            _source: 'source',
            _path: '/tmp/alpha/SKILL.md',
          },
          {
            id: 'source:beta',
            name: 'Beta',
            _source: 'source',
            _path: '/tmp/beta/SKILL.md',
          },
          {
            id: 'other:alpha',
            name: 'Alpha Other',
            _source: 'other',
            _path: '/tmp/other/SKILL.md',
          },
        ]),
      },
    }))
    mockModule('../../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../../src/installed')>(
        '../../../src/installed',
      )),
      loadInstalled: mock(async () => installedRecords),
    }))

    const { listSkills } = await import('../../../src/commands/skills/list')
    await listSkills(
      {
        sources: [createSource('source', true), createSource('other', true)],
      },
      {
        installed: true,
        project: true,
        source: 'source',
        _: ['alpha'],
      },
    )

    expect(prompts.intro).toHaveBeenCalledWith('Skill List')
    expect(consoleLines).toContain(
      `  ✅ source:alpha (codex @ project:${currentProjectPath})`,
    )
    expect(consoleLines).toContain(
      `     project:${currentProjectPath} -> codex`,
    )
    expect(consoleLines).not.toContain(
      '  ✅ source:beta (claude-code @ global)',
    )
    expect(consoleLines).not.toContain('  ✅ other:alpha')
    expect(prompts.note).not.toHaveBeenCalled()
    expect(prompts.outro).toHaveBeenCalledWith('1 skill(s)')
  })

  it('shows a note when no skills match the requested filters', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../../src/providers', () => ({
      providerRegistry: {
        discoverAll: mock(async () => [
          {
            id: 'source:alpha',
            name: 'Alpha',
            _source: 'source',
            _path: '/tmp/alpha/SKILL.md',
          },
        ]),
      },
    }))
    mockModule('../../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../../src/installed')>(
        '../../../src/installed',
      )),
      loadInstalled: mock(async () => []),
    }))

    const { listSkills } = await import('../../../src/commands/skills/list')
    await listSkills(
      {
        sources: [createSource('source', true)],
      },
      {
        installed: true,
        _: [],
      },
    )

    expect(consoleLines).toEqual([])
    expect(prompts.note).toHaveBeenCalledWith(
      'No skills found matching criteria',
    )
    expect(prompts.outro).toHaveBeenCalledWith('Done')
  })

  it('searchSkills uses the search title and query filtering path', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../../src/providers', () => ({
      providerRegistry: {
        discoverAll: mock(async () => [
          {
            id: 'source:brainstorming',
            name: 'Brainstorming',
            _source: 'source',
            _path: '/tmp/brainstorming/SKILL.md',
          },
          {
            id: 'source:debugging',
            name: 'Debugging',
            _source: 'source',
            _path: '/tmp/debugging/SKILL.md',
          },
        ]),
      },
    }))
    mockModule('../../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../../src/installed')>(
        '../../../src/installed',
      )),
      loadInstalled: mock(async () => []),
    }))

    const { searchSkills } = await import('../../../src/commands/skills/list')
    await searchSkills(
      {
        sources: [createSource('source', true)],
      },
      {
        _: ['brain'],
      },
    )

    expect(prompts.intro).toHaveBeenCalledWith('Search Skills')
    expect(consoleLines).toContain('  ⬜ source:brainstorming')
    expect(consoleLines).not.toContain('  ⬜ source:debugging')
    expect(prompts.outro).toHaveBeenCalledWith('1 skill(s)')
  })
})
