import { afterEach, describe, expect, it, mock } from 'bun:test'
import * as actualOs from 'os'
import { DEFAULT_CONFIG } from '../../src/types'

function createPromptMocks() {
  return {
    intro: mock(() => {}),
    outro: mock(() => {}),
    confirm: mock(async () => true),
    isCancel: () => false,
    spinner: () => ({
      start: mock(() => {}),
      stop: mock(() => {}),
      message: mock(() => {}),
    }),
  }
}

afterEach(() => {
  mock.restore()
})

describe('init command', () => {
  it('creates the default config when no config file exists', async () => {
    const prompts = createPromptMocks()
    const saveConfig = mock(async () => {})

    mock.module('@clack/prompts', () => prompts)
    mock.module('fs', () => ({
      existsSync: () => false,
    }))
    mock.module('os', () => ({
      ...actualOs,
      homedir: () => '/tmp/test-home',
    }))
    mock.module('node:os', () => ({
      ...actualOs,
      homedir: () => '/tmp/test-home',
    }))
    mock.module('../../src/config', () => ({
      saveConfig,
    }))

    const { initConfig } = await import('../../src/commands/init')
    await initConfig()

    expect(saveConfig).toHaveBeenCalledWith(DEFAULT_CONFIG)
    expect(prompts.outro).toHaveBeenCalledWith('Config file created at /tmp/test-home/.config/ki/config.yaml')
  })

  it('cancels when a config file exists and overwrite is declined', async () => {
    const prompts = createPromptMocks()
    prompts.confirm = mock(async () => false)
    const saveConfig = mock(async () => {})

    mock.module('@clack/prompts', () => prompts)
    mock.module('fs', () => ({
      existsSync: () => true,
    }))
    mock.module('os', () => ({
      ...actualOs,
      homedir: () => '/tmp/test-home',
    }))
    mock.module('node:os', () => ({
      ...actualOs,
      homedir: () => '/tmp/test-home',
    }))
    mock.module('../../src/config', () => ({
      saveConfig,
    }))

    const { initConfig } = await import('../../src/commands/init')
    await initConfig()

    expect(prompts.confirm).toHaveBeenCalledTimes(1)
    expect(saveConfig).not.toHaveBeenCalled()
    expect(prompts.outro).toHaveBeenCalledWith('Cancelled')
  })
})
