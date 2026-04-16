import { describe, expect, it, vi } from 'vitest'
import { collectInstallationDrift } from '../src/installations'
import type { Target } from '../src/types'

const mock = vi.fn

describe('installation drift scanning', () => {
  it('does not scan a duplicate project location when it matches the global path', async () => {
    const listMock = mock(async (scope: 'global' | 'project') => {
      if (scope === 'global') {
        return [
          {
            id: 'brainstorming',
            source: 'unknown',
            target: 'codex',
            scope: 'global',
            checksum: '',
            installedAt: new Date().toISOString(),
            enabled: true,
          },
        ]
      }

      return [
        {
          id: 'brainstorming',
          source: 'unknown',
          target: 'codex',
          scope: 'project',
          checksum: '',
          installedAt: new Date().toISOString(),
          enabled: true,
        },
      ]
    })

    const codexTarget: Target = {
      name: 'codex',
      install: async () => {},
      uninstall: async () => {},
      list: listMock,
      enable: async () => {},
      disable: async () => {},
      getGlobalPath: () => '/Users/zhiqiang/.agents/skills',
      getProjectPath: (projectPath: string) => `${projectPath}/.agents/skills`,
      resolveInstalledId: (skillId: string) =>
        skillId.split(':').pop() ?? skillId,
    }

    const drift = await collectInstallationDrift(
      [
        {
          id: 'source:brainstorming',
          source: 'source',
          targets: ['codex'],
          scope: 'global',
          checksum: 'sha256:1',
          installedAt: '2026-04-14T00:00:00.000Z',
          enabled: true,
        },
      ],
      [{ name: 'codex', enabled: true }],
      '/Users/zhiqiang',
      {
        targetRegistry: {
          get: mock((name: string) =>
            name === 'codex' ? codexTarget : undefined,
          ),
        },
      },
    )

    expect(listMock).toHaveBeenCalledTimes(1)
    expect(drift.untrackedTargetInstallations).toEqual([])
    expect(drift.missingRecordedTargets).toEqual([])
  })
})
