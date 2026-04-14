import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { InstalledRecord } from '../../../src/installed'
import { printSkillInstallations, printSourceSkillInstallations } from '../../../src/commands/skills/display'

const originalLog = console.log

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

afterEach(() => {
  console.log = originalLog
})

describe('display helpers', () => {
  it('prints skill installations with summary and details', () => {
    const calls: string[] = []
    console.log = mock((line: string) => {
      calls.push(line)
    }) as typeof console.log

    printSkillInstallations('source:alpha', [projectRecord, globalRecord])

    expect(calls).toEqual([
      '  ✅ source:alpha (cursor @ project:/tmp/project-a; claude-code @ global; codex @ global)',
      '     global -> claude-code, codex',
      '     project:/tmp/project-a -> cursor',
    ])
  })

  it('prints source-scoped installations with indented prefix', () => {
    const calls: string[] = []
    console.log = mock((line: string) => {
      calls.push(line)
    }) as typeof console.log

    printSourceSkillInstallations('source:alpha', [globalRecord])

    expect(calls).toEqual([
      '    ✅ source:alpha (claude-code @ global; codex @ global)',
      '     global -> claude-code, codex',
    ])
  })
})
