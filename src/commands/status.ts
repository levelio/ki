import * as p from '@clack/prompts'
import { type InstalledRecord, loadInstalled } from '../installed'
import type { Config } from '../types'
import { printSkillInstallations } from './skills/display'

function groupRecordsBySkill(
  records: InstalledRecord[],
): Array<[string, InstalledRecord[]]> {
  const grouped = new Map<string, InstalledRecord[]>()

  for (const record of records) {
    const existing = grouped.get(record.id)
    if (existing) {
      existing.push(record)
    } else {
      grouped.set(record.id, [record])
    }
  }

  return [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )
}

function printInstallationSection(
  title: string,
  records: InstalledRecord[],
): void {
  console.log(`\n${title}`)

  if (records.length === 0) {
    console.log('  (none)')
    return
  }

  for (const [skillId, groupedRecords] of groupRecordsBySkill(records)) {
    printSkillInstallations(skillId, groupedRecords)
  }
}

export async function showStatus(config: Pick<Config, 'sources' | 'targets'>) {
  p.intro('Status')

  const currentProjectPath = process.cwd()
  const installed = await loadInstalled()
  const enabledSources = config.sources.filter((source) => source.enabled)
  const enabledTargets = config.targets.filter((target) => target.enabled)
  const globalRecords = installed.filter((record) => record.scope === 'global')
  const currentProjectRecords = installed.filter(
    (record) =>
      record.scope === 'project' && record.projectPath === currentProjectPath,
  )

  console.log('\nOverview')
  console.log(
    `  Sources: ${enabledSources.length}/${config.sources.length} enabled`,
  )
  console.log(
    `  Targets: ${enabledTargets.length}/${config.targets.length} enabled`,
  )
  console.log(`  Current project: ${currentProjectPath}`)

  printInstallationSection('Global Installations', globalRecords)
  printInstallationSection(
    'Current Project Installations',
    currentProjectRecords,
  )

  console.log('')
  p.outro('Done')
}
