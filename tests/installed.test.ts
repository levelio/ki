import { describe, expect, it } from 'vitest'
import {
  type InstalledRecord,
  filterInstalledRecordsByScope,
  findInstalledRecordIndex,
  formatRecordLabel,
  formatRecordLocation,
  getInstalledRecordsForSkill,
  getRecordInstallOptions,
  getRecordKey,
  getSkillSummary,
  sortInstalledRecords,
} from '../src/installed'

const globalRecord: InstalledRecord = {
  id: 'source:alpha',
  source: 'source',
  targets: ['claude-code', 'codex'],
  scope: 'global',
  checksum: 'sha256:1',
  installedAt: '2026-04-14T00:00:00.000Z',
  enabled: true,
}

const projectRecordA: InstalledRecord = {
  id: 'source:alpha',
  source: 'source',
  targets: ['cursor'],
  scope: 'project',
  projectPath: '/tmp/project-a',
  checksum: 'sha256:2',
  installedAt: '2026-04-14T00:00:00.000Z',
  enabled: true,
}

const projectRecordB: InstalledRecord = {
  id: 'source:beta',
  source: 'source',
  targets: ['codex'],
  scope: 'project',
  projectPath: '/tmp/project-b',
  checksum: 'sha256:3',
  installedAt: '2026-04-14T00:00:00.000Z',
  enabled: false,
}

describe('installed helpers', () => {
  it('builds stable keys and locations', () => {
    expect(getRecordKey(globalRecord)).toBe('source:alpha::global::')
    expect(getRecordKey(projectRecordA)).toBe(
      'source:alpha::project::/tmp/project-a',
    )
    expect(formatRecordLocation(globalRecord)).toBe('global')
    expect(formatRecordLocation(projectRecordA)).toBe('project:/tmp/project-a')
    expect(formatRecordLabel(projectRecordA)).toBe(
      'source:alpha (project:/tmp/project-a) [cursor]',
    )
  })

  it('finds records by id + scope + projectPath', () => {
    const records = [globalRecord, projectRecordA, projectRecordB]

    expect(findInstalledRecordIndex(records, globalRecord)).toBe(0)
    expect(findInstalledRecordIndex(records, projectRecordA)).toBe(1)
    expect(
      findInstalledRecordIndex(records, {
        id: 'source:alpha',
        scope: 'project',
        projectPath: '/tmp/missing',
      }),
    ).toBe(-1)
  })

  it('filters and groups records by scope and skill id', () => {
    const records = [globalRecord, projectRecordA, projectRecordB]

    expect(
      filterInstalledRecordsByScope(
        records,
        { global: true },
        '/tmp/project-a',
      ),
    ).toEqual([globalRecord])
    expect(
      filterInstalledRecordsByScope(
        records,
        { project: true },
        '/tmp/project-a',
      ),
    ).toEqual([projectRecordA])
    expect(getInstalledRecordsForSkill(records, 'source:alpha')).toEqual([
      globalRecord,
      projectRecordA,
    ])
  })

  it('sorts records with global first then project path', () => {
    const sorted = sortInstalledRecords([
      projectRecordB,
      projectRecordA,
      globalRecord,
    ])
    expect(sorted).toEqual([globalRecord, projectRecordA, projectRecordB])
  })

  it('summarizes targets and returns strict install options', () => {
    expect(getSkillSummary([globalRecord, projectRecordA])).toBe(
      'claude-code @ global; codex @ global; cursor @ project:/tmp/project-a',
    )
    expect(getRecordInstallOptions(globalRecord)).toEqual({ scope: 'global' })
    expect(getRecordInstallOptions(projectRecordA)).toEqual({
      scope: 'project',
      projectPath: '/tmp/project-a',
    })
  })
})
