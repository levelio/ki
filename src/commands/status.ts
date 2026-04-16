import {
  collectInstallationDrift,
  formatScannedLocation,
  formatTargetInstallation,
} from '../installations'
import { type InstalledRecord, loadInstalled } from '../installed'
import type { Config } from '../types'
import * as p from '../ui'
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

  const drift = await collectInstallationDrift(
    installed,
    config.targets,
    currentProjectPath,
  )

  console.log('\nConsistency')
  if (
    drift.missingRecordedTargets.length === 0 &&
    drift.untrackedTargetInstallations.length === 0 &&
    drift.scanErrors.length === 0
  ) {
    console.log('  ✅ Installed index matches scanned targets')
  } else {
    for (const missing of drift.missingRecordedTargets) {
      console.log(
        `  ⚠️ Indexed install missing from target: ${missing.record.id} -> ${missing.targetName} @ ${formatScannedLocation(missing.record)}`,
      )
    }

    for (const untracked of drift.untrackedTargetInstallations) {
      console.log(
        `  ⚠️ Untracked target install: ${formatTargetInstallation(untracked, untracked.skillId)}`,
      )
    }

    for (const scanError of drift.scanErrors) {
      console.log(
        `  ⚠️ Failed to scan target: ${scanError.targetName} @ ${formatScannedLocation(scanError)} (${scanError.message})`,
      )
    }
  }

  console.log('')
  p.outro('Done')
}
