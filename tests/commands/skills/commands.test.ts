import { mockModule, resetModuleMocks } from 'test-mocks'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InstalledRecord } from '../../../src/installed'

const originalLog = console.log
const mock = vi.fn

function createSource(name = 'source') {
  return {
    name,
    provider: 'git',
    url: `https://github.com/acme/${name}.git`,
    enabled: true,
  }
}

function createPromptMocks() {
  const spinnerInstance = {
    start: mock(() => {}),
    stop: mock(() => {}),
    message: mock(() => {}),
  }

  return {
    intro: mock(() => {}),
    outro: mock(() => {}),
    note: mock(() => {}),
    isCancel: () => false,
    autocompleteMultiselect: mock(async () => []),
    confirm: mock(async () => true),
    spinner: mock(() => spinnerInstance),
    log: {
      error: mock(() => {}),
      warn: mock(() => {}),
      success: mock(() => {}),
    },
  }
}

afterEach(() => {
  resetModuleMocks()
  console.log = originalLog
})

describe('skill command non-interactive flows', () => {
  it('installSkill records only successfully installed targets', async () => {
    const prompts = createPromptMocks()
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})
    const installSuccess = mock(async () => {})
    const installFailure = mock(async () => {
      throw new Error('boom')
    })

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../../src/installed')>(
        '../../../src/installed',
      )),
      loadInstalled: mock(async () => []),
      saveInstalled: saveInstalledMock,
    }))
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
        fetchContent: mock(async () => ({
          id: 'source:alpha',
          content: '# Alpha',
          checksum: 'sha256:new',
        })),
      },
    }))
    mockModule('../../../src/targets', () => ({
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'claude-code') return { install: installSuccess }
          if (name === 'codex') return { install: installFailure }
          return undefined
        }),
      },
    }))

    const { installSkill } = await import(
      '../../../src/commands/skills/install'
    )
    await installSkill(
      {
        sources: [createSource()],
        targets: [
          { name: 'claude-code', enabled: true },
          { name: 'codex', enabled: true },
        ],
      },
      { _: ['source:alpha'], y: true, target: 'claude-code,codex' },
    )

    expect(installSuccess).toHaveBeenCalledTimes(1)
    expect(installFailure).toHaveBeenCalledTimes(1)
    expect(saveInstalledMock).toHaveBeenCalledTimes(1)
    expect(prompts.log.success).toHaveBeenCalledWith(
      'Installed source:alpha (claude-code @ global)',
    )
    expect(saveInstalledMock.mock.calls[0]?.[0]).toEqual([
      {
        id: 'source:alpha',
        source: 'source',
        targets: ['claude-code'],
        scope: 'global',
        checksum: 'sha256:new',
        installedAt: expect.any(String),
        enabled: true,
      },
    ])
    const installSpinner = prompts.spinner.mock.results[0]?.value as {
      stop: ReturnType<typeof mock>
    }
    expect(installSpinner.stop).toHaveBeenCalledWith(
      'Installed 1 skill instance(s) to 1 target(s) in global',
    )
    expect(prompts.outro).toHaveBeenCalledWith('Done')
  })

  it('installSkill supports dry-run without installing or writing records', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})
    const installMock = mock(async () => {})
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../../src/installed')>(
        '../../../src/installed',
      )),
      loadInstalled: mock(async () => []),
      saveInstalled: saveInstalledMock,
    }))
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
    mockModule('../../../src/targets', () => ({
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'codex') return { install: installMock }
          return undefined
        }),
      },
    }))

    const { installSkill } = await import(
      '../../../src/commands/skills/install'
    )
    await installSkill(
      {
        sources: [createSource()],
        targets: [{ name: 'codex', enabled: true }],
      },
      { _: ['source:alpha'], y: true, target: 'codex', 'dry-run': true },
    )

    expect(installMock).not.toHaveBeenCalled()
    expect(saveInstalledMock).not.toHaveBeenCalled()
    expect(prompts.spinner).not.toHaveBeenCalled()
    expect(consoleLines).toContain(
      '  Would install source:alpha (codex @ global)',
    )
    expect(prompts.outro).toHaveBeenCalledWith(
      'Dry run: 1 skill instance(s) would be installed',
    )
  })

  it('uninstallSkill removes only selected targets from a matching installation', async () => {
    const prompts = createPromptMocks()
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})
    const uninstallMock = mock(async () => {})
    const installedRecords: InstalledRecord[] = [
      {
        id: 'source:alpha',
        source: 'source',
        targets: ['claude-code', 'codex'],
        scope: 'global',
        checksum: 'sha256:1',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
      {
        id: 'source:beta',
        source: 'source',
        targets: ['cursor'],
        scope: 'global',
        checksum: 'sha256:2',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
    ]

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../../src/installed')>(
        '../../../src/installed',
      )),
      loadInstalled: mock(async () => installedRecords),
      saveInstalled: saveInstalledMock,
    }))
    mockModule('../../../src/targets', () => ({
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'claude-code') return { uninstall: uninstallMock }
          return undefined
        }),
      },
    }))

    const { uninstallSkill } = await import(
      '../../../src/commands/skills/uninstall'
    )
    await uninstallSkill({
      _: ['source:alpha'],
      y: true,
      target: 'claude-code',
    })

    expect(uninstallMock).toHaveBeenCalledTimes(1)
    const uninstallCalls = uninstallMock.mock.calls as any[][]
    const [uninstallCall] = uninstallCalls
    expect(uninstallCall?.[0]).toBe('source:alpha')
    expect(uninstallCall?.[1]).toEqual({ scope: 'global' })
    expect(saveInstalledMock).toHaveBeenCalledTimes(1)
    expect(saveInstalledMock.mock.calls[0]?.[0]).toEqual([
      {
        ...installedRecords[0],
        targets: ['codex'],
      },
      installedRecords[1],
    ])
  })

  it('updateSkills updates only changed records and persists the full installed set', async () => {
    const prompts = createPromptMocks()
    const installMock = mock(async () => {})
    const syncMock = mock(async () => {})
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})
    const installedRecords: InstalledRecord[] = [
      {
        id: 'source:alpha',
        source: 'source',
        targets: ['claude-code'],
        scope: 'global',
        checksum: 'sha256:old',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
      {
        id: 'source:beta',
        source: 'source',
        targets: ['codex'],
        scope: 'global',
        checksum: 'sha256:same',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
    ]

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../../src/installed')>(
        '../../../src/installed',
      )),
      loadInstalled: mock(async () => installedRecords),
      saveInstalled: saveInstalledMock,
    }))
    mockModule('../../../src/providers', () => ({
      providerRegistry: {
        sync: syncMock,
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
        ]),
        fetchContent: mock(async (skill: { id: string }) => ({
          id: skill.id,
          content: `# ${skill.id}`,
          checksum: skill.id === 'source:alpha' ? 'sha256:new' : 'sha256:same',
        })),
      },
    }))
    mockModule('../../../src/targets', () => ({
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'claude-code' || name === 'codex')
            return { install: installMock }
          return undefined
        }),
      },
    }))

    const { updateSkills } = await import('../../../src/commands/skills/update')
    await updateSkills(
      {
        sources: [createSource()],
      },
      { global: true, _: [] },
    )

    expect(syncMock).toHaveBeenCalledTimes(1)
    expect(installMock).toHaveBeenCalledTimes(1)
    expect(saveInstalledMock).toHaveBeenCalledTimes(1)
    expect(prompts.log.success).toHaveBeenCalledWith(
      'Updated source:alpha (claude-code @ global)',
    )
    expect(saveInstalledMock.mock.calls[0]?.[0]).toEqual([
      {
        ...installedRecords[0],
        checksum: 'sha256:new',
        installedAt: expect.any(String),
      },
      installedRecords[1],
    ])
    const spinnerInstance = prompts.spinner.mock.results[0]?.value as {
      stop: ReturnType<typeof mock>
    }
    expect(spinnerInstance.stop).toHaveBeenCalledWith(
      'Updated 1 installation(s)',
    )
  })

  it('updateSkills respects project scope filtering', async () => {
    const prompts = createPromptMocks()
    const installMock = mock(async () => {})
    const syncMock = mock(async () => {})
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})
    const currentProjectPath = process.cwd()
    const installedRecords: InstalledRecord[] = [
      {
        id: 'source:alpha',
        source: 'source',
        targets: ['claude-code'],
        scope: 'project',
        projectPath: currentProjectPath,
        checksum: 'sha256:old-current',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
      {
        id: 'source:beta',
        source: 'source',
        targets: ['codex'],
        scope: 'project',
        projectPath: '/tmp/other-project',
        checksum: 'sha256:old-other',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
      {
        id: 'source:gamma',
        source: 'source',
        targets: ['cursor'],
        scope: 'global',
        checksum: 'sha256:old-global',
        installedAt: '2026-04-14T00:00:00.000Z',
        enabled: true,
      },
    ]

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../../src/installed')>(
        '../../../src/installed',
      )),
      loadInstalled: mock(async () => installedRecords),
      saveInstalled: saveInstalledMock,
    }))
    mockModule('../../../src/providers', () => ({
      providerRegistry: {
        sync: syncMock,
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
            id: 'source:gamma',
            name: 'Gamma',
            _source: 'source',
            _path: '/tmp/gamma/SKILL.md',
          },
        ]),
        fetchContent: mock(async (skill: { id: string }) => ({
          id: skill.id,
          content: `# ${skill.id}`,
          checksum:
            skill.id === 'source:alpha'
              ? 'sha256:new-current'
              : 'sha256:unchanged',
        })),
      },
    }))
    mockModule('../../../src/targets', () => ({
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'claude-code' || name === 'codex' || name === 'cursor') {
            return { install: installMock }
          }
          return undefined
        }),
      },
    }))

    const { updateSkills } = await import('../../../src/commands/skills/update')
    await updateSkills(
      {
        sources: [createSource()],
      },
      { project: true, _: [] },
    )

    expect(syncMock).toHaveBeenCalledTimes(1)
    expect(installMock).toHaveBeenCalledTimes(1)
    const installCalls = installMock.mock.calls as any[][]
    expect(installCalls[0]?.[1]).toEqual({
      scope: 'project',
      projectPath: currentProjectPath,
    })
    expect(saveInstalledMock).toHaveBeenCalledTimes(1)
    expect(prompts.log.success).toHaveBeenCalledWith(
      `Updated source:alpha (claude-code @ project:${currentProjectPath})`,
    )
    expect(saveInstalledMock.mock.calls[0]?.[0]).toEqual([
      {
        ...installedRecords[0],
        checksum: 'sha256:new-current',
        installedAt: expect.any(String),
      },
      installedRecords[1],
      installedRecords[2],
    ])
  })

  it('updateSkills supports dry-run without installing or persisting changes', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    const installMock = mock(async () => {})
    const syncMock = mock(async () => {})
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../../src/installed')>(
        '../../../src/installed',
      )),
      loadInstalled: mock(async () => [
        {
          id: 'source:alpha',
          source: 'source',
          targets: ['codex'],
          scope: 'global',
          checksum: 'sha256:old',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
      ]),
      saveInstalled: saveInstalledMock,
    }))
    mockModule('../../../src/providers', () => ({
      providerRegistry: {
        sync: syncMock,
        discoverAll: mock(async () => [
          {
            id: 'source:alpha',
            name: 'Alpha',
            _source: 'source',
            _path: '/tmp/alpha/SKILL.md',
          },
        ]),
        fetchContent: mock(async () => ({
          id: 'source:alpha',
          content: '# source:alpha',
          checksum: 'sha256:new',
        })),
      },
    }))
    mockModule('../../../src/targets', () => ({
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'codex') return { install: installMock }
          return undefined
        }),
      },
    }))

    const { updateSkills } = await import('../../../src/commands/skills/update')
    await updateSkills(
      {
        sources: [createSource()],
      },
      { global: true, 'dry-run': true, _: [] },
    )

    expect(syncMock).toHaveBeenCalledTimes(1)
    expect(installMock).not.toHaveBeenCalled()
    expect(saveInstalledMock).not.toHaveBeenCalled()
    const spinnerInstance = prompts.spinner.mock.results[0]?.value as {
      stop: ReturnType<typeof mock>
    }
    expect(spinnerInstance.stop).toHaveBeenCalledWith(
      'Found 1 installation(s) with updates',
    )
    expect(consoleLines).toContain(
      '  Would update source:alpha (codex @ global)',
    )
    expect(prompts.outro).toHaveBeenCalledWith('Dry run complete')
  })

  it('updateSkills exits early when no installed records match the requested scope', async () => {
    const prompts = createPromptMocks()
    const syncMock = mock(async () => {})
    const discoverAllMock = mock(async () => [])
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../../src/installed')>(
        '../../../src/installed',
      )),
      loadInstalled: mock(async () => [
        {
          id: 'source:alpha',
          source: 'source',
          targets: ['claude-code'],
          scope: 'project',
          projectPath: '/tmp/other-project',
          checksum: 'sha256:old',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
      ]),
      saveInstalled: saveInstalledMock,
    }))
    mockModule('../../../src/providers', () => ({
      providerRegistry: {
        sync: syncMock,
        discoverAll: discoverAllMock,
      },
    }))
    mockModule('../../../src/targets', () => ({
      targetRegistry: {
        get: mock(() => undefined),
      },
    }))

    const { updateSkills } = await import('../../../src/commands/skills/update')
    await updateSkills(
      {
        sources: [createSource()],
      },
      { project: true, _: [] },
    )

    expect(prompts.note).toHaveBeenCalledWith('No matching installed skills')
    expect(prompts.outro).toHaveBeenCalledWith('Done')
    expect(syncMock).not.toHaveBeenCalled()
    expect(discoverAllMock).not.toHaveBeenCalled()
    expect(saveInstalledMock).not.toHaveBeenCalled()
  })
})
