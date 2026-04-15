import { mockModule, resetModuleMocks } from 'test-mocks'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mock = vi.fn

function createPromptMocks() {
  return {
    intro: mock(() => {}),
    outro: mock(() => {}),
  }
}

afterEach(() => {
  resetModuleMocks()
})

describe('target commands', () => {
  it('targetList renders enabled state and target paths', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    const originalLog = console.log
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/targets', () => ({
      targetRegistry: {
        get: mock((name: string) => {
          if (name === 'claude-code') {
            return {
              getGlobalPath: () => '/global/claude',
              getProjectPath: (projectPath: string) =>
                `${projectPath}/.claude/skills`,
            }
          }
          if (name === 'codex') {
            return {
              getGlobalPath: () => '/global/codex',
              getProjectPath: (projectPath: string) =>
                `${projectPath}/.agents/skills`,
            }
          }
          return undefined
        }),
      },
    }))

    const { targetList } = await import('../../src/commands/targets')
    await targetList({
      targets: [
        { name: 'claude-code', enabled: true },
        { name: 'codex', enabled: false },
      ],
    })

    console.log = originalLog

    expect(prompts.intro).toHaveBeenCalledWith('Targets')
    expect(consoleLines).toContain('  ◉ claude-code')
    expect(consoleLines).toContain('     Global: /global/claude')
    expect(consoleLines).toContain('     Project: ./.claude/skills')
    expect(consoleLines).toContain('  ◯ codex')
    expect(consoleLines).toContain('     Global: /global/codex')
    expect(consoleLines).toContain('     Project: ./.agents/skills')
    expect(prompts.outro).toHaveBeenCalledWith('2 target(s)')
  })

  it('targetList falls back when a target does not support global installs', async () => {
    const prompts = createPromptMocks()
    const consoleLines: string[] = []
    const originalLog = console.log
    console.log = mock((line = '') => {
      consoleLines.push(String(line))
    }) as typeof console.log

    mockModule('@clack/prompts', () => prompts)
    mockModule('../../src/targets', () => ({
      targetRegistry: {
        get: mock(() => ({
          getGlobalPath: () => {
            throw new Error('not supported')
          },
          getProjectPath: (projectPath: string) =>
            `${projectPath}/.cursor/skills`,
        })),
      },
    }))

    const { targetList } = await import('../../src/commands/targets')
    await targetList({
      targets: [{ name: 'cursor', enabled: true }],
    })

    console.log = originalLog

    expect(consoleLines).toContain('  ◉ cursor')
    expect(consoleLines).toContain('     Global: (not supported)')
    expect(consoleLines).toContain('     Project: ./.cursor/skills')
    expect(prompts.outro).toHaveBeenCalledWith('1 target(s)')
  })
})
