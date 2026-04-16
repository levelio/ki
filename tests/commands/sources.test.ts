import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { mockModule, resetModuleMocks } from 'test-mocks'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InstalledRecord } from '../../src/installed'

const mock = vi.fn

function setTTY(value: boolean) {
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value,
  })
  Object.defineProperty(process.stderr, 'isTTY', {
    configurable: true,
    value,
  })
}

setTTY(true)

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
    isCancel: () => false,
    spinner: () => ({
      start: mock(() => {}),
      stop: mock(() => {}),
      message: mock(() => {}),
    }),
    log: {
      error: mock(() => {}),
      warn: mock(() => {}),
      success: mock(() => {}),
    },
  }
}

afterEach(() => {
  setTTY(true)
  resetModuleMocks()
})

describe('source commands', () => {
  it('sourceSync syncs enabled sources and can target one source by name', async () => {
    const prompts = createPromptMocks()
    const syncMock = mock(async () => {})
    const discoverAllMock = mock(async () => [])

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/providers', () => ({
      providerRegistry: {
        sync: syncMock,
        discoverAll: discoverAllMock,
      },
    }))

    const { sourceSync } = await import('../../src/commands/sources')
    const config = {
      sources: [
        createSource('alpha', true),
        createSource('beta', false),
        createSource('gamma', true),
      ],
    }

    await sourceSync(config)
    expect(
      (syncMock.mock.calls as any[][]).map((call) => call[0].name),
    ).toEqual(['alpha', 'gamma'])
    expect(discoverAllMock).toHaveBeenCalledTimes(1)
    const discoverCalls = discoverAllMock.mock.calls as any[][]
    const [firstDiscoverCall] = discoverCalls
    expect(
      firstDiscoverCall?.[0].map((source: { name: string }) => source.name),
    ).toEqual(['alpha', 'gamma'])

    syncMock.mockClear()
    discoverAllMock.mockClear()

    await sourceSync(config, 'gamma')
    expect(
      (syncMock.mock.calls as any[][]).map((call) => call[0].name),
    ).toEqual(['gamma'])
    const [secondDiscoverCall] = discoverAllMock.mock.calls as any[][]
    expect(
      secondDiscoverCall?.[0].map((source: { name: string }) => source.name),
    ).toEqual(['gamma'])
  })

  it('sourceSync reports missing or disabled named sources', async () => {
    const prompts = createPromptMocks()
    const syncMock = mock(async () => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/providers', () => ({
      providerRegistry: {
        sync: syncMock,
        discoverAll: mock(async () => []),
      },
    }))

    const { sourceSync } = await import('../../src/commands/sources')
    const result = await sourceSync(
      {
        sources: [createSource('alpha', true)],
      },
      'missing',
    )

    expect(result).toBe(false)
    expect(syncMock).not.toHaveBeenCalled()
    expect(prompts.log.error).toHaveBeenCalledWith(
      'Source not found or disabled: missing',
    )
  })

  it('sourceSkills renders installed status using installed records', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    const originalLog = console.log
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/providers', () => ({
      providerRegistry: {
        discoverAll: mock(async () => [
          {
            id: 'alpha:brainstorming',
            name: 'Brainstorming',
            _source: 'alpha',
            _path: '/tmp/a',
          },
          {
            id: 'alpha:debugging',
            name: 'Debugging',
            _source: 'alpha',
            _path: '/tmp/b',
          },
        ]),
      },
    }))
    mockModule('../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../src/installed')>(
        '../../src/installed',
      )),
      loadInstalled: mock(async () => [
        {
          id: 'alpha:brainstorming',
          source: 'alpha',
          targets: ['claude-code'],
          scope: 'global',
          checksum: 'sha256:1',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
      ]),
    }))

    const { sourceSkills } = await import('../../src/commands/sources')
    const result = await sourceSkills(
      {
        sources: [createSource('alpha', true)],
      },
      'alpha',
      {},
    )

    console.log = originalLog

    expect(result).toBe(true)
    expect(consoleLines).toContain('\n  alpha (2)')
    expect(consoleLines).toContain(
      '    ✅ alpha:brainstorming (claude-code @ global)',
    )
    expect(consoleLines).toContain('    ⬜ alpha:debugging')
  })

  it('sourceSkills prints an explicit empty result message', async () => {
    const prompts = createPromptMocks()

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/providers', () => ({
      providerRegistry: {
        discoverAll: mock(async () => []),
      },
    }))
    mockModule('../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../src/installed')>(
        '../../src/installed',
      )),
      loadInstalled: mock(async () => []),
    }))

    const { sourceSkills } = await import('../../src/commands/sources')
    const result = await sourceSkills(
      {
        sources: [createSource('alpha', true)],
      },
      'alpha',
      {},
    )

    expect(result).toBe(true)
    expect(prompts.note).toHaveBeenCalledWith(
      'No skills found in alpha',
      undefined,
    )
    expect(prompts.outro).toHaveBeenCalledWith('0 skill(s)')
  })

  it('sourceEnable and sourceDisable mutate config and persist it', async () => {
    const prompts = createPromptMocks()
    const saveConfigMock = mock(async (_config: unknown) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/config', async () => ({
      ...(await vi.importActual<typeof import('../../src/config')>(
        '../../src/config',
      )),
      saveConfig: saveConfigMock,
    }))

    const { sourceEnable, sourceDisable } = await import(
      '../../src/commands/sources'
    )
    const config = {
      sources: [createSource('alpha', false)],
      targets: [],
    }

    await sourceEnable(config, 'alpha')
    expect(config.sources[0].enabled).toBe(true)
    expect(saveConfigMock).toHaveBeenCalledWith(config)
    expect(prompts.log.success).toHaveBeenCalledWith('Enabled source: alpha')

    saveConfigMock.mockClear()

    await sourceDisable(config, 'alpha')
    expect(config.sources[0].enabled).toBe(false)
    expect(saveConfigMock).toHaveBeenCalledWith(config)
    expect(prompts.log.warn).toHaveBeenCalledWith('Disabled source: alpha')
  })

  it('sourceInstall installs every skill from a source to the requested targets', async () => {
    const prompts = createPromptMocks()
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})
    const installMock = mock(async () => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../src/installed')>(
        '../../src/installed',
      )),
      loadInstalled: mock(async () => []),
      saveInstalled: saveInstalledMock,
    }))
    mockModule('../../src/providers', () => ({
      providerRegistry: {
        discoverAll: mock(async () => [
          {
            id: 'alpha:brainstorming',
            name: 'Brainstorming',
            _source: 'alpha',
            _path: '/tmp/a',
          },
          {
            id: 'alpha:debugging',
            name: 'Debugging',
            _source: 'alpha',
            _path: '/tmp/b',
          },
        ]),
        fetchContent: mock(async (skill: { id: string; _source: string }) => ({
          id: skill.id,
          content: `# ${skill.id}`,
          checksum: `sha256:${skill.id}`,
        })),
      },
    }))
    mockModule('../../src/targets', () => ({
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'codex') {
            return {
              install: installMock,
              isInstalled: mock(async () => true),
            }
          }
          return undefined
        }),
      },
    }))

    const { sourceInstall } = await import('../../src/commands/sources')
    const result = await sourceInstall(
      {
        sources: [createSource('alpha', true)],
        targets: [{ name: 'codex', enabled: true }],
      },
      'alpha',
      { _: [], target: 'codex' },
    )

    expect(result).toBe(true)
    expect(installMock).toHaveBeenCalledTimes(2)
    expect(saveInstalledMock).toHaveBeenCalledWith([
      {
        id: 'alpha:brainstorming',
        source: 'alpha',
        targets: ['codex'],
        scope: 'global',
        checksum: 'sha256:alpha:brainstorming',
        installedAt: expect.any(String),
        enabled: true,
      },
      {
        id: 'alpha:debugging',
        source: 'alpha',
        targets: ['codex'],
        scope: 'global',
        checksum: 'sha256:alpha:debugging',
        installedAt: expect.any(String),
        enabled: true,
      },
    ])
    expect(prompts.log.success).toHaveBeenCalledWith(
      'Installed alpha:brainstorming (codex @ global)',
    )
    expect(prompts.log.success).toHaveBeenCalledWith(
      'Installed alpha:debugging (codex @ global)',
    )
  })

  it('sourceInstall saves earlier successful installs when a later skill fetch fails', async () => {
    const prompts = createPromptMocks()
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})
    const installMock = mock(async () => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../src/installed')>(
        '../../src/installed',
      )),
      loadInstalled: mock(async () => []),
      saveInstalled: saveInstalledMock,
    }))
    mockModule('../../src/providers', () => ({
      providerRegistry: {
        discoverAll: mock(async () => [
          {
            id: 'alpha:brainstorming',
            name: 'Brainstorming',
            _source: 'alpha',
            _path: '/tmp/a',
          },
          {
            id: 'alpha:debugging',
            name: 'Debugging',
            _source: 'alpha',
            _path: '/tmp/b',
          },
        ]),
        fetchContent: mock(async (skill: { id: string }) => {
          if (skill.id === 'alpha:debugging') {
            throw new Error('broken skill')
          }

          return {
            id: skill.id,
            content: `# ${skill.id}`,
            checksum: `sha256:${skill.id}`,
          }
        }),
      },
    }))
    mockModule('../../src/targets', () => ({
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'codex') {
            return {
              install: installMock,
              isInstalled: mock(async () => true),
            }
          }
          return undefined
        }),
      },
    }))

    const { sourceInstall } = await import('../../src/commands/sources')
    const result = await sourceInstall(
      {
        sources: [createSource('alpha', true)],
        targets: [{ name: 'codex', enabled: true }],
      },
      'alpha',
      { _: [], target: 'codex' },
    )

    expect(result).toBe(false)
    expect(saveInstalledMock).toHaveBeenCalledWith([
      {
        id: 'alpha:brainstorming',
        source: 'alpha',
        targets: ['codex'],
        scope: 'global',
        checksum: 'sha256:alpha:brainstorming',
        installedAt: expect.any(String),
        enabled: true,
      },
    ])
    expect(prompts.log.warn).toHaveBeenCalledWith(
      'Skipped alpha:debugging: failed to fetch content: broken skill',
    )
  })

  it('sourceUninstall removes all installed skills from a source for the requested target', async () => {
    const prompts = createPromptMocks()
    const uninstallMock = mock(async () => {})
    const installedRecords: InstalledRecord[] = [
      {
        id: 'alpha:brainstorming',
        source: 'alpha',
        targets: ['codex'],
        scope: 'global',
        checksum: 'sha256:1',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
      {
        id: 'alpha:debugging',
        source: 'alpha',
        targets: ['codex'],
        scope: 'global',
        checksum: 'sha256:2',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
      {
        id: 'beta:other',
        source: 'beta',
        targets: ['codex'],
        scope: 'global',
        checksum: 'sha256:3',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
    ]
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../src/installed')>(
        '../../src/installed',
      )),
      loadInstalled: mock(async () => installedRecords),
      saveInstalled: saveInstalledMock,
    }))
    mockModule('../../src/targets', () => ({
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'codex') {
            return {
              uninstall: uninstallMock,
              isInstalled: mock(async () => false),
            }
          }
          return undefined
        }),
      },
    }))

    const { sourceUninstall } = await import('../../src/commands/sources')
    const result = await sourceUninstall(
      {
        sources: [createSource('alpha', true)],
      },
      'alpha',
      { _: [], target: 'codex', global: true },
    )

    expect(result).toBe(true)
    expect(uninstallMock).toHaveBeenCalledTimes(2)
    expect(uninstallMock).toHaveBeenCalledWith('alpha:brainstorming', {
      scope: 'global',
    })
    expect(uninstallMock).toHaveBeenCalledWith('alpha:debugging', {
      scope: 'global',
    })
    expect(saveInstalledMock).toHaveBeenCalledWith([
      {
        id: 'beta:other',
        source: 'beta',
        targets: ['codex'],
        scope: 'global',
        checksum: 'sha256:3',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
    ])
  })

  it('sourceUninstall removes records for unavailable targets', async () => {
    const prompts = createPromptMocks()
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../src/installed')>(
        '../../src/installed',
      )),
      loadInstalled: mock(async () => [
        {
          id: 'alpha:brainstorming',
          source: 'alpha',
          targets: ['missing-target'],
          scope: 'global',
          checksum: 'sha256:1',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
      ]),
      saveInstalled: saveInstalledMock,
    }))
    mockModule('../../src/targets', () => ({
      targetRegistry: {
        get: mock(() => undefined),
      },
    }))

    const { sourceUninstall } = await import('../../src/commands/sources')
    const result = await sourceUninstall(
      {
        sources: [createSource('alpha', true)],
      },
      'alpha',
      { _: [], target: 'missing-target', global: true },
    )

    expect(result).toBe(true)
    expect(saveInstalledMock).toHaveBeenCalledWith([])
    expect(prompts.log.warn).toHaveBeenCalledWith(
      'Removed install record for alpha:brainstorming from missing-target without running a target uninstall because the target is unavailable',
    )
  })

  it('sourceAdd adds a git source with an inferred name and rejects duplicates', async () => {
    const prompts = createPromptMocks()
    const saveConfigMock = mock(async (_config: unknown) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/config', async () => ({
      ...(await vi.importActual<typeof import('../../src/config')>(
        '../../src/config',
      )),
      saveConfig: saveConfigMock,
    }))

    const { sourceAdd } = await import('../../src/commands/sources')
    const config = {
      sources: [createSource('alpha', true)],
      targets: [],
    }

    await sourceAdd(config, 'https://github.com/acme/skills.git')
    expect(config.sources).toContainEqual({
      name: 'skills',
      provider: 'git',
      url: 'https://github.com/acme/skills.git',
      enabled: true,
    })
    expect(saveConfigMock).toHaveBeenCalledWith(config)
    expect(prompts.log.success).toHaveBeenCalledWith('Added source: skills')

    saveConfigMock.mockClear()

    await sourceAdd(config, 'https://github.com/acme/skills.git')
    expect(saveConfigMock).not.toHaveBeenCalled()
    expect(prompts.log.error).toHaveBeenCalledWith(
      'Source already exists: skills',
    )
  })

  it('sourceAdd persists structured source options and disabled state', async () => {
    const prompts = createPromptMocks()
    const saveConfigMock = mock(async (_config: unknown) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/config', async () => ({
      ...(await vi.importActual<typeof import('../../src/config')>(
        '../../src/config',
      )),
      saveConfig: saveConfigMock,
    }))

    const { sourceAdd } = await import('../../src/commands/sources')
    const config = {
      sources: [],
      targets: [],
    }

    await sourceAdd(config, 'https://github.com/acme/skills.git', 'acme', {
      _: [],
      branch: 'develop',
      'skills-path': 'packages/agent/skills,skills/system',
      structure: 'nested',
      'skill-file': 'AGENT.md',
      disabled: true,
    })

    expect(config.sources).toContainEqual({
      name: 'acme',
      provider: 'git',
      url: 'https://github.com/acme/skills.git',
      options: {
        branch: 'develop',
        skillsPath: ['packages/agent/skills', 'skills/system'],
        structure: 'nested',
        skillFile: 'AGENT.md',
      },
      enabled: false,
    })
    expect(saveConfigMock).toHaveBeenCalledWith(config)
  })

  it('sourceAdd adds a local source from an existing directory', async () => {
    const prompts = createPromptMocks()
    const saveConfigMock = mock(async (_config: unknown) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/config', async () => ({
      ...(await vi.importActual<typeof import('../../src/config')>(
        '../../src/config',
      )),
      saveConfig: saveConfigMock,
    }))

    const { sourceAdd } = await import('../../src/commands/sources')
    const config = {
      sources: [],
      targets: [],
    }

    await sourceAdd(config, './skills')

    expect(config.sources).toContainEqual({
      name: 'skills',
      provider: 'local',
      url: resolve('./skills'),
      enabled: true,
    })
    expect(saveConfigMock).toHaveBeenCalledWith(config)
    expect(prompts.log.success).toHaveBeenCalledWith('Added source: skills')
  })

  it('sourceAdd rejects unsupported source inputs', async () => {
    const prompts = createPromptMocks()
    const saveConfigMock = mock(async (_config: unknown) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/config', async () => ({
      ...(await vi.importActual<typeof import('../../src/config')>(
        '../../src/config',
      )),
      saveConfig: saveConfigMock,
    }))

    const { sourceAdd } = await import('../../src/commands/sources')
    await sourceAdd(
      {
        sources: [],
        targets: [],
      },
      '/tmp/local-skills-that-does-not-exist',
    )

    expect(saveConfigMock).not.toHaveBeenCalled()
    expect(prompts.log.error).toHaveBeenCalledWith(
      'Unsupported source. Use a git URL or an existing local directory: /tmp/local-skills-that-does-not-exist',
    )
  })

  it('sourceRemove deletes an existing source and reports missing ones', async () => {
    const prompts = createPromptMocks()
    const saveConfigMock = mock(async (_config: unknown) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/config', async () => ({
      ...(await vi.importActual<typeof import('../../src/config')>(
        '../../src/config',
      )),
      saveConfig: saveConfigMock,
    }))

    const { sourceRemove } = await import('../../src/commands/sources')
    const config = {
      sources: [createSource('alpha', true), createSource('beta', false)],
      targets: [],
    }

    await sourceRemove(config, 'alpha')
    expect(config.sources).toEqual([createSource('beta', false)])
    expect(saveConfigMock).toHaveBeenCalledWith(config)
    expect(prompts.log.warn).toHaveBeenCalledWith('Removed source: alpha')

    saveConfigMock.mockClear()

    await sourceRemove(config, 'missing')
    expect(saveConfigMock).not.toHaveBeenCalled()
    expect(prompts.log.error).toHaveBeenCalledWith('Source not found: missing')
  })

  it('sourceSet updates options and enabled state for an existing source', async () => {
    const prompts = createPromptMocks()
    const saveConfigMock = mock(async (_config: unknown) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/config', async () => ({
      ...(await vi.importActual<typeof import('../../src/config')>(
        '../../src/config',
      )),
      saveConfig: saveConfigMock,
    }))

    const { sourceSet } = await import('../../src/commands/sources')
    const config = {
      sources: [
        {
          ...createSource('alpha', true),
          options: { branch: 'main', skillsPath: 'skills' },
        },
      ],
      targets: [],
    }

    await sourceSet(config, 'alpha', {
      _: [],
      branch: 'develop',
      'skills-path': 'packages/agent/skills',
      disable: true,
    })

    expect(config.sources[0]).toEqual({
      ...createSource('alpha', false),
      options: {
        branch: 'develop',
        skillsPath: 'packages/agent/skills',
      },
    })
    expect(saveConfigMock).toHaveBeenCalledWith(config)
    expect(prompts.log.success).toHaveBeenCalledWith('Updated source: alpha')
  })

  it('sourceUnset removes option overrides from an existing source', async () => {
    const prompts = createPromptMocks()
    const saveConfigMock = mock(async (_config: unknown) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/config', async () => ({
      ...(await vi.importActual<typeof import('../../src/config')>(
        '../../src/config',
      )),
      saveConfig: saveConfigMock,
    }))

    const { sourceUnset } = await import('../../src/commands/sources')
    const config = {
      sources: [
        {
          ...createSource('alpha', true),
          options: {
            branch: 'main',
            skillsPath: ['skills', 'skills/system'],
            structure: 'nested',
          },
        },
      ],
      targets: [],
    }

    await sourceUnset(config, 'alpha', {
      _: [],
      branch: true,
      'skills-path': true,
    })

    expect(config.sources[0]).toEqual({
      ...createSource('alpha', true),
      options: {
        structure: 'nested',
      },
    })
    expect(saveConfigMock).toHaveBeenCalledWith(config)
    expect(prompts.log.success).toHaveBeenCalledWith(
      'Unset source options: alpha',
    )
  })

  it('sourceUnset also removes legacy local path overrides', async () => {
    const prompts = createPromptMocks()
    const saveConfigMock = mock(async (_config: unknown) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/config', async () => ({
      ...(await vi.importActual<typeof import('../../src/config')>(
        '../../src/config',
      )),
      saveConfig: saveConfigMock,
    }))

    const { sourceUnset } = await import('../../src/commands/sources')
    const config = {
      sources: [
        {
          name: 'local-source',
          provider: 'local',
          url: '/tmp/local-source',
          enabled: true,
          options: {
            path: 'legacy/skills',
          },
        },
      ],
      targets: [],
    }

    await sourceUnset(config, 'local-source', {
      _: [],
      'skills-path': true,
    })

    expect(config.sources[0]).toEqual({
      name: 'local-source',
      provider: 'local',
      url: '/tmp/local-source',
      enabled: true,
    })
    expect(saveConfigMock).toHaveBeenCalledWith(config)
  })

  it('sourceShow renders configured and effective source values', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    const originalLog = console.log
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mockModule('@clack/prompts', () => prompts)

    const { sourceShow } = await import('../../src/commands/sources')
    await sourceShow(
      {
        sources: [
          {
            ...createSource('alpha', true),
            options: {
              branch: 'develop',
              skillsPath: ['packages/agent/skills', 'skills/system'],
            },
          },
        ],
      },
      'alpha',
    )

    console.log = originalLog

    expect(consoleLines).toContain('  Provider: git')
    expect(consoleLines).toContain('  URL: https://github.com/acme/alpha.git')
    expect(consoleLines).toContain('  Options:')
    expect(consoleLines).toContain('    branch:')
    expect(consoleLines).toContain('    - packages/agent/skills')
    expect(consoleLines).toContain('  Effective:')
    expect(consoleLines).toContain('  Resolved:')
    expect(consoleLines).toContain(
      `    sourceRoot: ${homedir()}/.config/ki/cache/github.com-acme-alpha`,
    )
  })

  it('sourceShow respects legacy local path overrides in effective output', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    const originalLog = console.log
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mockModule('@clack/prompts', () => prompts)

    const { sourceShow } = await import('../../src/commands/sources')
    await sourceShow(
      {
        sources: [
          {
            name: 'local-source',
            provider: 'local',
            url: '/tmp/local-source',
            enabled: true,
            options: {
              path: 'legacy/skills',
            },
          },
        ],
      },
      'local-source',
    )

    console.log = originalLog

    expect(consoleLines).toContain('    skillsPath:')
    expect(consoleLines).toContain('    legacy/skills')
    expect(consoleLines).toContain('      - /tmp/local-source/legacy/skills')
  })
})
