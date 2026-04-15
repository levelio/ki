import { describe, expect, it } from 'vitest'
import {
  selectInstallSkillIds,
  selectInstallTargets,
  selectUninstallRecords,
  selectUninstallTargets,
} from '../../../src/commands/skills/select'
import type { InstalledRecord } from '../../../src/installed'

const globalRecord: InstalledRecord = {
  id: 'source:alpha',
  source: 'source',
  targets: ['claude-code', 'codex'],
  scope: 'global',
  checksum: 'sha256:1',
  installedAt: '2026-04-14T00:00:00.000Z',
  enabled: true,
}

const projectRecord: InstalledRecord = {
  id: 'source:alpha',
  source: 'source',
  targets: ['cursor'],
  scope: 'project',
  projectPath: '/tmp/project-a',
  checksum: 'sha256:2',
  installedAt: '2026-04-14T00:00:00.000Z',
  enabled: true,
}

describe('skill selection helpers', () => {
  it('selects install skill directly in non-interactive exact-match mode', async () => {
    await expect(
      selectInstallSkillIds([{ id: 'source:alpha' }], true, true),
    ).resolves.toEqual(['source:alpha'])
  })

  it('selects install targets from explicit flags or enabled targets', async () => {
    await expect(
      selectInstallTargets([], { t: 'claude-code,codex' }, true),
    ).resolves.toEqual(['claude-code', 'codex'])

    await expect(
      selectInstallTargets(
        [
          { name: 'claude-code', enabled: true },
          { name: 'codex', enabled: false },
          { name: 'cursor', enabled: true },
        ],
        {},
        true,
      ),
    ).resolves.toEqual(['claude-code', 'cursor'])
  })

  it('selects uninstall records only when non-interactive input is unambiguous', async () => {
    await expect(selectUninstallRecords([globalRecord], true)).resolves.toEqual(
      [globalRecord],
    )
    await expect(
      selectUninstallRecords([globalRecord, projectRecord], true),
    ).resolves.toBeNull()
  })

  it('selects uninstall targets from flags or unique recorded targets', async () => {
    await expect(
      selectUninstallTargets(
        [globalRecord],
        { target: 'claude-code,codex' },
        true,
      ),
    ).resolves.toEqual(['claude-code', 'codex'])

    await expect(
      selectUninstallTargets([globalRecord, projectRecord], {}, true),
    ).resolves.toEqual(['claude-code', 'codex', 'cursor'])

    await expect(
      selectUninstallTargets(
        [{ ...projectRecord, targets: ['cursor'] }],
        {},
        false,
      ),
    ).resolves.toEqual(['cursor'])
  })
})
