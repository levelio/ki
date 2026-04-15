import { describe, expect, it, vi } from 'vitest'
import { TargetRegistry } from '../../src/targets/registry'
import type { SkillContent, Target } from '../../src/types'

const mock = vi.fn

function createTarget(name: string) {
  return {
    name,
    install: mock(async () => {}),
    uninstall: mock(async () => {}),
    list: mock(async () => []),
    enable: mock(async () => {}),
    disable: mock(async () => {}),
    getGlobalPath: () => `/global/${name}`,
    getProjectPath: (projectPath: string) => `${projectPath}/.${name}`,
  } satisfies Target
}

describe('TargetRegistry', () => {
  it('getEnabled returns only enabled registered targets', () => {
    const registry = new TargetRegistry()
    const codex = createTarget('codex')
    const cursor = createTarget('cursor')

    registry.register(codex)
    registry.register(cursor)

    expect(
      registry.getEnabled([
        { name: 'codex', enabled: true },
        { name: 'cursor', enabled: false },
        { name: 'missing', enabled: true },
      ]),
    ).toEqual([codex])
  })

  it('installToAll installs to enabled global targets', async () => {
    const registry = new TargetRegistry()
    const codex = createTarget('codex')
    const cursor = createTarget('cursor')
    const skill: SkillContent = {
      id: 'source:alpha',
      content: '# Alpha',
      checksum: 'sha256:1',
    }

    registry.register(codex)
    registry.register(cursor)

    await registry.installToAll(
      skill,
      [
        { name: 'codex', enabled: true },
        { name: 'cursor', enabled: true },
        { name: 'missing', enabled: true },
      ],
      'global',
    )

    expect(codex.install).toHaveBeenCalledWith(skill, { scope: 'global' })
    expect(cursor.install).toHaveBeenCalledWith(skill, { scope: 'global' })
  })

  it('installToAll passes project install options through to enabled targets', async () => {
    const registry = new TargetRegistry()
    const codex = createTarget('codex')
    const skill: SkillContent = {
      id: 'source:beta',
      content: '# Beta',
      checksum: 'sha256:2',
    }

    registry.register(codex)

    await registry.installToAll(
      skill,
      [{ name: 'codex', enabled: true }],
      'project',
      '/tmp/project',
    )

    expect(codex.install).toHaveBeenCalledWith(skill, {
      scope: 'project',
      projectPath: '/tmp/project',
    })
  })

  it('uninstallFromAll passes skill id and options through to enabled targets', async () => {
    const registry = new TargetRegistry()
    const codex = createTarget('codex')
    const cursor = createTarget('cursor')

    registry.register(codex)
    registry.register(cursor)

    await registry.uninstallFromAll(
      'source:alpha',
      [
        { name: 'codex', enabled: true },
        { name: 'cursor', enabled: true },
      ],
      'project',
      '/tmp/project',
    )

    expect(codex.uninstall).toHaveBeenCalledWith('source:alpha', {
      scope: 'project',
      projectPath: '/tmp/project',
    })
    expect(cursor.uninstall).toHaveBeenCalledWith('source:alpha', {
      scope: 'project',
      projectPath: '/tmp/project',
    })
  })
})
