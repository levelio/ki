import { mockModule, resetModuleMocks } from 'test-mocks'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mock = vi.fn
const originalStdoutTTY = process.stdout.isTTY
const originalStderrTTY = process.stderr.isTTY

function createPromptMocks() {
  return {
    intro: mock(() => {}),
    outro: mock(() => {}),
    note: mock(() => {}),
    confirm: mock(async () => true),
    autocompleteMultiselect: mock(async () => ['alpha']),
    isCancel: mock(() => false),
    spinner: mock(() => ({
      start: mock(() => {}),
      stop: mock(() => {}),
      cancel: mock(() => {}),
      error: mock(() => {}),
      message: mock(() => {}),
      clear: mock(() => {}),
      isCancelled: false,
    })),
    log: {
      error: mock(() => {}),
      warn: mock(() => {}),
      success: mock(() => {}),
    },
  }
}

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

afterEach(() => {
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value: originalStdoutTTY,
  })
  Object.defineProperty(process.stderr, 'isTTY', {
    configurable: true,
    value: originalStderrTTY,
  })
  resetModuleMocks()
  vi.restoreAllMocks()
})

describe('ui adapter', () => {
  it('uses plain console output when stdout/stderr are not TTYs', async () => {
    const prompts = createPromptMocks()
    const stdout: string[] = []
    const stderr: string[] = []

    setTTY(false)
    mockModule('@clack/prompts', () => prompts)

    const logSpy = vi.spyOn(console, 'log').mockImplementation((value) => {
      stdout.push(String(value))
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((value) => {
      stderr.push(String(value))
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((value) => {
      stderr.push(String(value))
    })

    const ui = await import('../src/ui')
    ui.intro('Install Skill')
    ui.note('No skills found', 'superpowers')
    ui.log.success('Installed skill')
    ui.log.warn('Partial failure')
    ui.log.error('Install failed')
    const spinner = ui.spinner()
    spinner.start('Installing...')
    spinner.message('Installing superpowers:brainstorming...')
    spinner.stop('Installed 1 skill instance(s)')
    ui.outro('Done')

    expect(stdout).toEqual([
      'Install Skill',
      'superpowers: No skills found',
      'Success: Installed skill',
      'Installing...',
      'Installing superpowers:brainstorming...',
      'Installed 1 skill instance(s)',
      'Done',
    ])
    expect(stderr).toEqual([
      'Warning: Partial failure',
      'Error: Install failed',
    ])
    expect(prompts.intro).not.toHaveBeenCalled()
    expect(prompts.spinner).not.toHaveBeenCalled()

    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('falls back safely for non-tty prompt APIs', async () => {
    const prompts = createPromptMocks()

    setTTY(false)
    mockModule('@clack/prompts', () => prompts)

    const ui = await import('../src/ui')
    await expect(
      ui.confirm({
        message: 'Overwrite?',
        initialValue: false,
      }),
    ).resolves.toBe(false)
    await expect(
      ui.autocompleteMultiselect({
        message: 'Select skills',
        options: [{ value: 'alpha', label: 'alpha' }],
      }),
    ).rejects.toThrow('Interactive prompts require a TTY')
  })
})
