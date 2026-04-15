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
  it('selects install skill directly in exact-match mode', async () => {
    await expect(
      selectInstallSkillIds([{ id: 'source:alpha' }], false),
    ).resolves.toEqual(['source:alpha'])
    await expect(
      selectInstallSkillIds([{ id: 'source:alpha' }, { id: 'source:beta' }], false),
    ).resolves.toBeNull()
  })

  it('selects install targets from explicit flags or enabled targets', async () => {
    await expect(
      selectInstallTargets([], { t: 'claude-code,codex' }, false),
    ).resolves.toEqual(['claude-code', 'codex'])

    await expect(
      selectInstallTargets(
        [
          { name: 'claude-code', enabled: true },
          { name: 'codex', enabled: false },
          { name: 'cursor', enabled: true },
        ],
        {},
        false,
      ),
    ).resolves.toBeNull()

    await expect(
      selectInstallTargets([{ name: 'claude-code', enabled: true }], {}, false),
    ).resolves.toEqual(['claude-code'])
  })

  it('selects uninstall records only when input is unambiguous', async () => {
    await expect(selectUninstallRecords([globalRecord])).resolves.toEqual(
      [globalRecord],
    )
    await expect(
      selectUninstallRecords([globalRecord, projectRecord]),
    ).resolves.toBeNull()
  })

  it('selects uninstall targets from flags or a single recorded target', async () => {
    await expect(
      selectUninstallTargets([globalRecord], { target: 'claude-code,codex' }),
    ).resolves.toEqual(['claude-code', 'codex'])

    await expect(
      selectUninstallTargets([globalRecord, projectRecord], {}),
    ).resolves.toBeNull()

    await expect(
      selectUninstallTargets([{ ...projectRecord, targets: ['cursor'] }], {}),
    ).resolves.toEqual(['cursor'])
  })
})
