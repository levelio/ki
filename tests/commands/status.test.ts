import { afterEach, describe, expect, it, mock } from 'bun:test'
import * as actualInstalled from '../../src/installed'

const originalLog = console.log

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
  mock.restore()
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

    mock.module('@clack/prompts', () => prompts)
    mock.module('../../src/installed', () => ({
      ...actualInstalled,
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
      sources: [
        createSource('source', true),
        createSource('disabled', false),
      ],
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
    expect(consoleLines).toContain(`  ✅ source:alpha (cursor @ project:${currentProjectPath})`)
    expect(prompts.outro).toHaveBeenCalledWith('Done')
  })

  it('shows empty sections when nothing is installed', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mock.module('@clack/prompts', () => prompts)
    mock.module('../../src/installed', () => ({
      ...actualInstalled,
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
})
