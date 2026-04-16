import { mockModule, resetModuleMocks } from 'test-mocks'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
  return {
    intro: mock(() => {}),
    outro: mock(() => {}),
  }
}

function createSource(name: string, enabled: boolean) {
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

describe('status command', () => {
  it('shows enabled sources, targets, and grouped global and project installs', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    const currentProjectPath = process.cwd()
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
        {
          id: 'source:alpha',
          source: 'source',
          targets: ['cursor'],
          scope: 'project',
          projectPath: currentProjectPath,
          checksum: 'sha256:2',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
      ]),
    }))

    const { showStatus } = await import('../../src/commands/status')
    await showStatus({
      sources: [createSource('source', true), createSource('disabled', false)],
      targets: [
        { name: 'codex', enabled: true },
        { name: 'cursor', enabled: true },
        { name: 'claude-code', enabled: false },
      ],
    })

    expect(prompts.intro).toHaveBeenCalledWith('Status')
    expect(consoleLines).toContain('\nOverview')
    expect(consoleLines).toContain('  Sources: 1/2 enabled')
    expect(consoleLines).toContain('  Targets: 2/3 enabled')
    expect(consoleLines).toContain(`  Current project: ${currentProjectPath}`)
    expect(consoleLines).toContain('\nGlobal Installations')
    expect(consoleLines).toContain('  ✅ source:alpha (codex @ global)')
    expect(consoleLines).toContain('\nCurrent Project Installations')
    expect(consoleLines).toContain(
      `  ✅ source:alpha (cursor @ project:${currentProjectPath})`,
    )
    expect(prompts.outro).toHaveBeenCalledWith('Done')
  })

  it('shows empty sections when nothing is installed', async () => {
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
      loadInstalled: mock(async () => []),
    }))

    const { showStatus } = await import('../../src/commands/status')
    await showStatus({
      sources: [createSource('source', true)],
      targets: [{ name: 'codex', enabled: true }],
    })

    expect(consoleLines).toContain('\nGlobal Installations')
    expect(consoleLines).toContain('  (none)')
    expect(consoleLines).toContain('\nCurrent Project Installations')
    expect(prompts.outro).toHaveBeenCalledWith('Done')
  })

  it('reports drift between installed records and scanned target state', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    const currentProjectPath = process.cwd()
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
        untrackedTargetInstallations: [
          {
            targetName: 'cursor',
            skillId: 'brainstorming',
            scope: 'project',
            projectPath: currentProjectPath,
          },
        ],
        scanErrors: [],
      })),
    }))

    const { showStatus } = await import('../../src/commands/status')
    await showStatus({
      sources: [createSource('source', true)],
      targets: [
        { name: 'codex', enabled: true },
        { name: 'cursor', enabled: true },
      ],
    })

    expect(consoleLines).toContain('\nConsistency')
    expect(consoleLines).toContain(
      '  ⚠️ Indexed install missing from target: source:alpha -> codex @ global',
    )
    expect(consoleLines).toContain(
      `  ⚠️ Untracked target install: cursor -> brainstorming @ project:${currentProjectPath}`,
    )
  })
})
