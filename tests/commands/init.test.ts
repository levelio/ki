import { mockModule, resetModuleMocks } from 'test-mocks'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../../src/types'

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
  setTTY(true)
  resetModuleMocks()
})

describe('init command', () => {
  it('creates the default config when no config file exists', async () => {
    const prompts = createPromptMocks()
    const saveConfig = mock(async () => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('fs', () => ({
      existsSync: () => false,
    }))
    mockModule('os', async () => ({
      ...(await vi.importActual<typeof import('os')>('os')),
      homedir: () => '/tmp/test-home',
    }))
    mockModule('node:os', async () => ({
      ...(await vi.importActual<typeof import('node:os')>('node:os')),
      homedir: () => '/tmp/test-home',
    }))
    mockModule('../../src/config', async () => ({
      ...(await vi.importActual<typeof import('../../src/config')>(
        '../../src/config',
      )),
      saveConfig,
    }))

    const { initConfig } = await import('../../src/commands/init')
    await initConfig()

    expect(saveConfig).toHaveBeenCalledWith(DEFAULT_CONFIG)
    expect(prompts.outro).toHaveBeenCalledWith(
      'Config file created at /tmp/test-home/.config/ki/config.yaml',
    )
  })

  it('cancels when a config file exists and overwrite is declined', async () => {
    const prompts = createPromptMocks()
    prompts.confirm = mock(async () => false)
    const saveConfig = mock(async () => {})

    mockModule('@clack/prompts', () => prompts)
    mockModule('fs', () => ({
      existsSync: () => true,
    }))
    mockModule('os', async () => ({
      ...(await vi.importActual<typeof import('os')>('os')),
      homedir: () => '/tmp/test-home',
    }))
    mockModule('node:os', async () => ({
      ...(await vi.importActual<typeof import('node:os')>('node:os')),
      homedir: () => '/tmp/test-home',
    }))
    mockModule('../../src/config', async () => ({
      ...(await vi.importActual<typeof import('../../src/config')>(
        '../../src/config',
      )),
      saveConfig,
    }))

    const { initConfig } = await import('../../src/commands/init')
    await initConfig()

    expect(prompts.confirm).toHaveBeenCalledTimes(1)
    expect(saveConfig).not.toHaveBeenCalled()
    expect(prompts.outro).toHaveBeenCalledWith('Cancelled')
  })
})
