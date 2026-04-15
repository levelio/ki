import { describe, expect, it, vi } from 'vitest'
import { VERSION, parseFlags, run } from '../src/cli'
import type { Config } from '../src/types'

const mock = vi.fn

function createCommands() {
  return {
    runDoctor: mock(async () => {}),
    initConfig: mock(async () => {}),
    installSkill: mock(async () => {}),
    listSkills: mock(async () => {}),
    searchSkills: mock(async () => {}),
    showStatus: mock(async () => {}),
    sourceAdd: mock(async () => {}),
    sourceDisable: mock(async () => {}),
    sourceEnable: mock(async () => {}),
    sourceList: mock(async () => {}),
    sourceRemove: mock(async () => {}),
    sourceSkills: mock(async () => {}),
    sourceSync: mock(async () => {}),
    targetList: mock(async () => {}),
    uninstallSkill: mock(async () => {}),
    updateSkills: mock(async () => {}),
  }
}

function createConfig(overrides: Partial<Config> = {}): Config {
  return {
    sources: [
      {
        name: 'source',
        provider: 'git',
        url: 'https://github.com/acme/skills.git',
        enabled: true,
      },
    ],
    targets: [{ name: 'codex', enabled: true }],
    ...overrides,
  }
}

describe('cli', () => {
  it('parseFlags parses long flags, short flags, and positional args', () => {
    expect(
      parseFlags(['install', '--target', 'codex,cursor', '-y', '--project']),
    ).toEqual({
      _: ['install'],
      target: 'codex,cursor',
      y: true,
      project: true,
    })
  })

  it('shows help without loading config when no args are provided', async () => {
    const commands = createCommands()
    const log = mock(() => {})
    const error = mock(() => {})
    const exit = mock(() => {})
    const loadConfig = mock(async () =>
      createConfig({ sources: [], targets: [] }),
    )

    await run([], { commands, log, error, exit, loadConfig })

    expect(loadConfig).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(expect.stringContaining(`ki v${VERSION}`))
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('shows version without loading config', async () => {
    const commands = createCommands()
    const log = mock(() => {})
    const exit = mock(() => {})
    const loadConfig = mock(async () => createConfig())

    await run(['--version'], {
      commands,
      loadConfig,
      log,
      error: mock(() => {}),
      exit,
    })

    expect(loadConfig).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(`ki v${VERSION}`)
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('routes install with parsed flags', async () => {
    const commands = createCommands()
    const config = createConfig()
    const loadConfig = mock(async () => config)

    await run(['install', 'source:alpha', '--target', 'codex', '-y'], {
      commands,
      loadConfig,
      log: mock(() => {}),
      error: mock(() => {}),
      exit: mock(() => {}),
    })

    expect(loadConfig).toHaveBeenCalledTimes(1)
    expect(commands.installSkill).toHaveBeenCalledWith(config, {
      _: ['source:alpha'],
      target: 'codex',
      y: true,
    })
  })

  it('routes update with dry-run flag', async () => {
    const commands = createCommands()
    const config = createConfig()

    await run(['update', '--dry-run', '--project'], {
      commands,
      loadConfig: mock(async () => config),
      log: mock(() => {}),
      error: mock(() => {}),
      exit: mock(() => {}),
    })

    expect(commands.updateSkills).toHaveBeenCalledWith(config, {
      _: [],
      'dry-run': true,
      project: true,
    })
  })

  it('routes search with the query as a positional flag', async () => {
    const commands = createCommands()
    const config = createConfig()

    await run(['search', 'brainstorming'], {
      commands,
      loadConfig: mock(async () => config),
      log: mock(() => {}),
      error: mock(() => {}),
      exit: mock(() => {}),
    })

    expect(commands.searchSkills).toHaveBeenCalledWith(config, {
      _: ['brainstorming'],
    })
  })

  it('routes status without extra flags', async () => {
    const commands = createCommands()
    const config = createConfig()

    await run(['status'], {
      commands,
      loadConfig: mock(async () => config),
      log: mock(() => {}),
      error: mock(() => {}),
      exit: mock(() => {}),
    })

    expect(commands.showStatus).toHaveBeenCalledWith(config)
  })

  it('routes doctor without extra flags', async () => {
    const commands = createCommands()
    const config = createConfig()

    await run(['doctor'], {
      commands,
      loadConfig: mock(async () => config),
      log: mock(() => {}),
      error: mock(() => {}),
      exit: mock(() => {}),
    })

    expect(commands.runDoctor).toHaveBeenCalledWith(config)
  })

  it('reports missing source names for source enable', async () => {
    const commands = createCommands()
    const error = mock(() => {})
    const exit = mock(() => {})
    const loadConfig = mock(async () =>
      createConfig({ sources: [], targets: [] }),
    )

    await run(['source', 'enable'], {
      commands,
      loadConfig,
      log: mock(() => {}),
      error,
      exit,
    })

    expect(commands.sourceEnable).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith('Please specify a source name')
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('routes source add with an explicit name flag', async () => {
    const commands = createCommands()
    const config = createConfig()

    await run(
      ['source', 'add', 'https://github.com/acme/skills.git', '--name', 'acme'],
      {
        commands,
        loadConfig: mock(async () => config),
        log: mock(() => {}),
        error: mock(() => {}),
        exit: mock(() => {}),
      },
    )

    expect(commands.sourceAdd).toHaveBeenCalledWith(
      config,
      'https://github.com/acme/skills.git',
      'acme',
    )
  })

  it('reports missing source URLs for source add', async () => {
    const commands = createCommands()
    const error = mock(() => {})
    const exit = mock(() => {})

    await run(['source', 'add'], {
      commands,
      loadConfig: mock(async () => createConfig()),
      log: mock(() => {}),
      error,
      exit,
    })

    expect(commands.sourceAdd).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(
      'Please specify a git source URL or local directory path',
    )
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('routes source remove', async () => {
    const commands = createCommands()
    const config = createConfig()

    await run(['source', 'remove', 'source'], {
      commands,
      loadConfig: mock(async () => config),
      log: mock(() => {}),
      error: mock(() => {}),
      exit: mock(() => {}),
    })

    expect(commands.sourceRemove).toHaveBeenCalledWith(config, 'source')
  })

  it('shows source subcommand help for unknown source actions', async () => {
    const commands = createCommands()
    const log = mock(() => {})

    await run(['source', 'wat'], {
      commands,
      loadConfig: mock(async () => createConfig()),
      log,
      error: mock(() => {}),
      exit: mock(() => {}),
    })

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Source commands:'),
    )
    expect(commands.sourceList).not.toHaveBeenCalled()
    expect(commands.sourceSync).not.toHaveBeenCalled()
  })

  it('routes target list subcommands', async () => {
    const commands = createCommands()
    const config = createConfig()

    await run(['target', 'list'], {
      commands,
      loadConfig: mock(async () => config),
      log: mock(() => {}),
      error: mock(() => {}),
      exit: mock(() => {}),
    })

    expect(commands.targetList).toHaveBeenCalledWith(config)
  })

  it('shows target subcommand help for unknown target actions', async () => {
    const commands = createCommands()
    const log = mock(() => {})

    await run(['target', 'wat'], {
      commands,
      loadConfig: mock(async () => createConfig()),
      log,
      error: mock(() => {}),
      exit: mock(() => {}),
    })

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Target commands:'),
    )
    expect(commands.targetList).not.toHaveBeenCalled()
  })

  it('reports unknown commands and exits with code 1', async () => {
    const commands = createCommands()
    const log = mock(() => {})
    const error = mock(() => {})
    const exit = mock(() => {})
    const loadConfig = mock(async () =>
      createConfig({ sources: [], targets: [] }),
    )

    await run(['wat'], {
      commands,
      loadConfig,
      log,
      error,
      exit,
    })

    expect(error).toHaveBeenCalledWith('Unknown command: wat')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Usage:'))
    expect(exit).toHaveBeenCalledWith(1)
  })
})
