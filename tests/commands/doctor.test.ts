import { afterEach, describe, expect, it, mock } from 'bun:test'
import { homedir } from 'os'
import { join } from 'path'

const originalLog = console.log
const missingGlobalPath = join(homedir(), '.agents', 'skills')
const missingProjectPath = '/tmp/ki-doctor-missing-project-path-7f4f2b38'

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

async function importDoctorModule() {
  return import(`../../src/commands/doctor.ts?test=${Math.random()}`)
}

afterEach(() => {
  mock.restore()
  console.log = originalLog
})

describe('doctor command', () => {
  it('reports no issues for a healthy configuration', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mock.module('@clack/prompts', () => prompts)

    const { runDoctor } = await importDoctorModule()
    await runDoctor({
      sources: [createSource('source', true)],
      targets: [{ name: 'codex', enabled: true }],
    }, {
      loadInstalled: mock(async () => []),
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'codex') {
            return {
              getGlobalPath: () => missingGlobalPath,
              getProjectPath: (projectPath: string) => `${projectPath}/.agents/skills`,
            }
          }
          return undefined
        }),
      },
      pathExists: mock(() => true),
      cwd: () => '/tmp/ki-doctor-cwd',
    })

    expect(prompts.intro).toHaveBeenCalledWith('Doctor')
    expect(consoleLines).toContain('\nChecks')
    expect(consoleLines).toContain('  ✅ No issues found')
    expect(prompts.outro).toHaveBeenCalledWith('Done')
  })

  it('reports configuration and installed-record issues', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mock.module('@clack/prompts', () => prompts)

    const { runDoctor } = await importDoctorModule()
    await runDoctor({
      sources: [],
      targets: [
        { name: 'codex', enabled: false },
        { name: 'unknown-target', enabled: false },
      ],
    }, {
      loadInstalled: mock(async () => [
        {
          id: 'missing-source:alpha',
          source: 'missing-source',
          targets: ['missing-target'],
          scope: 'global',
          checksum: 'sha256:1',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
      ]),
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'codex') {
            return {
              getGlobalPath: () => missingGlobalPath,
              getProjectPath: (projectPath: string) => `${projectPath}/.agents/skills`,
            }
          }
          return undefined
        }),
      },
      pathExists: mock(() => false),
      cwd: () => '/tmp/ki-doctor-cwd',
    })

    expect(consoleLines).toContain('  ⚠️ No sources configured')
    expect(consoleLines).toContain('     Fix: ki source add <git-url-or-path> --name <source-name>')
    expect(consoleLines).toContain('  ⚠️ No enabled sources')
    expect(consoleLines).toContain('  ⚠️ No enabled targets')
    expect(consoleLines).toContain('     Fix: Enable at least one target in your ki config, then run ki doctor again')
    expect(consoleLines).toContain('  ❌ Configured target is not supported: unknown-target')
    expect(consoleLines).toContain('     Fix: Run ki target list, then remove or rename unknown-target in your ki config')
    expect(consoleLines).toContain('  ❌ Installed record references missing source: missing-source:alpha -> missing-source')
    expect(consoleLines).toContain('     Fix: ki uninstall missing-source:alpha --global -y')
    expect(consoleLines).toContain('  ❌ Installed record references missing target config: missing-source:alpha -> missing-target')
    expect(consoleLines).toContain('     Fix: ki uninstall missing-source:alpha -t missing-target --global -y')
    expect(prompts.outro).toHaveBeenCalledWith('Found 6 issue(s)')
  })
})
