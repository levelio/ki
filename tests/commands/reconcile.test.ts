import { mockModule, resetModuleMocks } from 'test-mocks'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InstalledRecord } from '../../src/installed'

const originalLog = console.log
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
    spinner: mock(() => spinnerInstance),
    log: {
      warn: mock(() => {}),
      success: mock(() => {}),
      error: mock(() => {}),
    },
  }
}

function createSource(name = 'source', enabled = true) {
  return {
    name,
    provider: 'git',
    url: `https://github.com/acme/${name}.git`,
    enabled,
  }
}

afterEach(() => {
  setTTY(true)
  resetModuleMocks()
  console.log = originalLog
})

describe('reconcile commands', () => {
  it('reconcileInstallations reports drift and returns failure', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../src/installed')>(
        '../../src/installed',
      )),
      loadInstalled: mock(async () => [
        {
          id: 'source:alpha',
          source: 'source',
          targets: ['codex'],
          scope: 'global',
          checksum: 'sha256:1',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
      ]),
    }))
    mockModule('../../src/installations', async () => ({
      ...(await vi.importActual<typeof import('../../src/installations')>(
        '../../src/installations',
      )),
      collectInstallationDrift: mock(async () => ({
        missingRecordedTargets: [
          {
            record: {
              id: 'source:alpha',
              source: 'source',
              targets: ['codex'],
              scope: 'global',
              checksum: 'sha256:1',
              installedAt: '2026-04-14T00:00:00.000Z',
              enabled: true,
            },
            targetName: 'codex',
          },
        ],
        untrackedTargetInstallations: [],
        scanErrors: [],
      })),
    }))

    const { reconcileInstallations } = await import(
      '../../src/commands/reconcile'
    )
    const result = await reconcileInstallations({
      targets: [{ name: 'codex', enabled: true }],
    })

    expect(result).toBe(false)
    expect(consoleLines).toContain('\nChecks')
    expect(consoleLines).toContain(
      '  ⚠️ Indexed install missing from target: source:alpha -> codex @ global',
    )
    expect(prompts.outro).toHaveBeenCalledWith('Found 1 drift issue(s)')
  })

  it('repairInstalledIndex removes missing indexed targets and saves repaired records', async () => {
    const prompts = createPromptMocks()
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})
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
    mockModule('../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../src/installed')>(
        '../../src/installed',
      )),
      loadInstalled: mock(async () => installedRecords),
      saveInstalled: saveInstalledMock,
    }))
    mockModule('../../src/installations', async () => ({
      ...(await vi.importActual<typeof import('../../src/installations')>(
        '../../src/installations',
      )),
      collectInstallationDrift: mock(async () => ({
        missingRecordedTargets: [
          {
            record: installedRecords[0],
            targetName: 'claude-code',
          },
        ],
        untrackedTargetInstallations: [],
        scanErrors: [],
      })),
    }))

    const { repairInstalledIndex } = await import(
      '../../src/commands/reconcile'
    )
    const result = await repairInstalledIndex(
      {
        targets: [
          { name: 'claude-code', enabled: true },
          { name: 'codex', enabled: true },
          { name: 'cursor', enabled: true },
        ],
      },
      {},
    )

    expect(result).toBe(true)
    expect(saveInstalledMock).toHaveBeenCalledWith([
      {
        ...installedRecords[0],
        targets: ['codex'],
      },
      installedRecords[1],
    ])
    expect(prompts.outro).toHaveBeenCalledWith(
      'Repair complete: removed 1 missing target record(s) across 0 record(s)',
    )
  })

  it('repairInstalledIndex supports dry-run without writing records', async () => {
    const prompts = createPromptMocks()
    const saveInstalledMock = mock(async (_records: InstalledRecord[]) => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../src/installed')>(
        '../../src/installed',
      )),
      loadInstalled: mock(async () => [
        {
          id: 'source:alpha',
          source: 'source',
          targets: ['codex'],
          scope: 'global',
          checksum: 'sha256:1',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
      ]),
      saveInstalled: saveInstalledMock,
    }))
    mockModule('../../src/installations', async () => ({
      ...(await vi.importActual<typeof import('../../src/installations')>(
        '../../src/installations',
      )),
      collectInstallationDrift: mock(async () => ({
        missingRecordedTargets: [
          {
            record: {
              id: 'source:alpha',
              source: 'source',
              targets: ['codex'],
              scope: 'global',
              checksum: 'sha256:1',
              installedAt: '2026-04-14T00:00:00.000Z',
              enabled: true,
            },
            targetName: 'codex',
          },
        ],
        untrackedTargetInstallations: [],
        scanErrors: [],
      })),
    }))

    const { repairInstalledIndex } = await import(
      '../../src/commands/reconcile'
    )
    const result = await repairInstalledIndex(
      {
        targets: [{ name: 'codex', enabled: true }],
      },
      { 'dry-run': true },
    )

    expect(result).toBe(true)
    expect(saveInstalledMock).not.toHaveBeenCalled()
    expect(prompts.outro).toHaveBeenCalledWith(
      'Dry run complete: removed 1 missing target record(s) across 1 record(s)',
    )
  })

  it('restoreInstallations restores global records and honors source filter', async () => {
    const prompts = createPromptMocks()
    const syncMock = mock(async () => {})
    const installMock = mock(async () => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../src/installed')>(
        '../../src/installed',
      )),
      loadInstalled: mock(async () => [
        {
          id: 'source:alpha',
          source: 'source',
          targets: ['codex'],
          scope: 'global',
          checksum: 'sha256:1',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
        {
          id: 'other:beta',
          source: 'other',
          targets: ['cursor'],
          scope: 'global',
          checksum: 'sha256:2',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
      ]),
    }))
    mockModule('../../src/providers', () => ({
      providerRegistry: {
        sync: syncMock,
        discoverAll: mock(async (sources: Array<{ name: string }>) => {
          if (sources[0]?.name === 'source') {
            return [
              {
                id: 'source:alpha',
                name: 'Alpha',
                _source: 'source',
                _path: '/tmp/alpha/SKILL.md',
              },
            ]
          }

          return []
        }),
        fetchContent: mock(async () => ({
          id: 'source:alpha',
          content: '# Alpha',
          checksum: 'sha256:new',
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

    const { restoreInstallations } = await import(
      '../../src/commands/reconcile'
    )
    const result = await restoreInstallations(
      {
        sources: [createSource('source', true), createSource('other', true)],
      },
      { source: 'source' },
    )

    expect(result).toBe(true)
    expect(syncMock).toHaveBeenCalledTimes(1)
    expect(installMock).toHaveBeenCalledTimes(1)
    expect(prompts.log.success).toHaveBeenCalledWith(
      'Restored source:alpha (codex @ global)',
    )
    const spinnerInstance = prompts.spinner.mock.results[0]?.value as {
      stop: ReturnType<typeof mock>
    }
    expect(spinnerInstance.stop).toHaveBeenCalledWith(
      'Restored 1 global installation(s) to 1 target(s)',
    )
  })

  it('restoreInstallations can restore from a disabled but configured source', async () => {
    const prompts = createPromptMocks()
    const syncMock = mock(async () => {})
    const installMock = mock(async () => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/installed', async () => ({
      ...(await vi.importActual<typeof import('../../src/installed')>(
        '../../src/installed',
      )),
      loadInstalled: mock(async () => [
        {
          id: 'source:alpha',
          source: 'source',
          targets: ['codex'],
          scope: 'global',
          checksum: 'sha256:1',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
      ]),
    }))
    mockModule('../../src/providers', () => ({
      providerRegistry: {
        sync: syncMock,
        discoverAll: mock(async (sources: Array<{ enabled: boolean }>) => {
          expect(sources[0]?.enabled).toBe(true)
          return [
            {
              id: 'source:alpha',
              name: 'Alpha',
              _source: 'source',
              _path: '/tmp/alpha/SKILL.md',
            },
          ]
        }),
        fetchContent: mock(async () => ({
          id: 'source:alpha',
          content: '# Alpha',
          checksum: 'sha256:new',
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

    const { restoreInstallations } = await import(
      '../../src/commands/reconcile'
    )
    const result = await restoreInstallations(
      {
        sources: [createSource('source', false)],
      },
      {},
    )

    expect(result).toBe(true)
    expect(syncMock).toHaveBeenCalledTimes(1)
    expect(installMock).toHaveBeenCalledTimes(1)
  })
})
