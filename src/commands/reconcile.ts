import {
  collectInstallationDrift,
  formatScannedLocation,
  formatTargetInstallation,
  isSkillInstalledInTarget,
} from '../installations'
import {
  type InstalledRecord,
  loadInstalled,
  saveInstalled,
} from '../installed'
import { providerRegistry } from '../providers'
import { targetRegistry } from '../targets'
import type { CliFlags, Config, InstallOptions, SkillContent } from '../types'
import * as p from '../ui'

function printDriftIssues(
  records: InstalledRecord[],
  issues: Awaited<ReturnType<typeof collectInstallationDrift>>,
) {
  console.log('\nChecks')

  if (
    issues.missingRecordedTargets.length === 0 &&
    issues.untrackedTargetInstallations.length === 0 &&
    issues.scanErrors.length === 0
  ) {
    console.log('  ✅ No drift detected')
    return
  }

  for (const missing of issues.missingRecordedTargets) {
    console.log(
      `  ⚠️ Indexed install missing from target: ${missing.record.id} -> ${missing.targetName} @ ${formatScannedLocation(missing.record)}`,
    )
  }

  for (const untracked of issues.untrackedTargetInstallations) {
    console.log(
      `  ⚠️ Untracked target install: ${formatTargetInstallation(untracked, untracked.skillId)}`,
    )
  }

  for (const scanError of issues.scanErrors) {
    console.log(
      `  ⚠️ Failed to scan target: ${scanError.targetName} @ ${formatScannedLocation(scanError)} (${scanError.message})`,
    )
  }

  if (records.length === 0) {
    console.log('  ℹ️ No installed records in index')
  }
}

function getDriftIssueCount(
  issues: Awaited<ReturnType<typeof collectInstallationDrift>>,
): number {
  return (
    issues.missingRecordedTargets.length +
    issues.untrackedTargetInstallations.length +
    issues.scanErrors.length
  )
}

export async function reconcileInstallations(
  config: Pick<Config, 'targets'>,
): Promise<boolean> {
  p.intro('Reconcile')

  const records = await loadInstalled()
  const currentProjectPath = process.cwd()
  const issues = await collectInstallationDrift(
    records,
    config.targets,
    currentProjectPath,
  )

  console.log('\nSummary')
  console.log(`  Indexed records: ${records.length}`)
  console.log(`  Current project: ${currentProjectPath}`)

  printDriftIssues(records, issues)

  const issueCount = getDriftIssueCount(issues)
  if (issueCount === 0) {
    p.outro('Done')
    return true
  }

  p.outro(`Found ${issueCount} drift issue(s)`)
  return false
}

export async function repairInstalledIndex(
  config: Pick<Config, 'targets'>,
  flags: CliFlags = { _: [] },
): Promise<boolean> {
  p.intro('Repair')

  const dryRun = Boolean(flags['dry-run'])
  const records = await loadInstalled()
  const currentProjectPath = process.cwd()
  const issues = await collectInstallationDrift(
    records,
    config.targets,
    currentProjectPath,
  )

  const removedTargetsByRecord = new Map<string, Set<string>>()
  for (const missing of issues.missingRecordedTargets) {
    const key = `${missing.record.id}::${missing.record.scope}::${missing.record.projectPath ?? ''}`
    let targets = removedTargetsByRecord.get(key)
    if (!targets) {
      targets = new Set<string>()
      removedTargetsByRecord.set(key, targets)
    }
    targets.add(missing.targetName)
  }

  const repairedRecords = records
    .map((record) => {
      const key = `${record.id}::${record.scope}::${record.projectPath ?? ''}`
      const removedTargets = removedTargetsByRecord.get(key)
      if (!removedTargets || removedTargets.size === 0) {
        return record
      }

      const nextTargets = record.targets.filter(
        (target) => !removedTargets.has(target),
      )
      if (nextTargets.length === 0) {
        return null
      }

      return { ...record, targets: nextTargets }
    })
    .filter(Boolean) as InstalledRecord[]

  const removedTargetCount = issues.missingRecordedTargets.length
  const removedRecordCount = records.length - repairedRecords.length

  console.log('\nSummary')
  console.log(`  Indexed records: ${records.length}`)
  console.log(`  Missing indexed targets: ${removedTargetCount}`)
  console.log(
    `  Untracked target installs: ${issues.untrackedTargetInstallations.length}`,
  )
  console.log(`  Scan errors: ${issues.scanErrors.length}`)

  if (removedTargetCount === 0) {
    printDriftIssues(records, issues)
    if (
      issues.untrackedTargetInstallations.length === 0 &&
      issues.scanErrors.length === 0
    ) {
      p.outro('Done')
      return true
    }

    p.outro(
      `No index repairs applied; ${getDriftIssueCount(issues)} issue(s) remain`,
    )
    return false
  }

  console.log('\nActions')
  for (const missing of issues.missingRecordedTargets) {
    console.log(
      `  ${dryRun ? 'Would remove' : 'Removed'} ${missing.record.id} -> ${missing.targetName} @ ${formatScannedLocation(missing.record)} from installed index`,
    )
  }

  if (!dryRun) {
    await saveInstalled(repairedRecords)
  }

  const unresolvedIssueCount =
    issues.untrackedTargetInstallations.length + issues.scanErrors.length

  if (
    issues.untrackedTargetInstallations.length > 0 ||
    issues.scanErrors.length > 0
  ) {
    printDriftIssues(repairedRecords, {
      missingRecordedTargets: [],
      untrackedTargetInstallations: issues.untrackedTargetInstallations,
      scanErrors: issues.scanErrors,
    })
  }

  const action = dryRun ? 'Dry run complete' : 'Repair complete'
  if (unresolvedIssueCount > 0) {
    p.outro(
      `${action}: removed ${removedTargetCount} missing target record(s) across ${removedRecordCount} record(s); ${unresolvedIssueCount} issue(s) remain`,
    )
    return false
  }

  p.outro(
    `${action}: removed ${removedTargetCount} missing target record(s) across ${removedRecordCount} record(s)`,
  )
  return true
}

export async function restoreInstallations(
  config: Pick<Config, 'sources'>,
  flags: CliFlags = { _: [] },
): Promise<boolean> {
  p.intro('Restore')

  const dryRun = Boolean(flags['dry-run'])
  const requestedSource =
    typeof flags.source === 'string' ? flags.source : undefined
  const allRecords = await loadInstalled()
  const records = allRecords.filter(
    (record) =>
      record.scope === 'global' &&
      (!requestedSource || record.source === requestedSource),
  )

  if (records.length === 0) {
    p.note('No matching global installed records')
    p.outro('Done')
    return true
  }

  if (dryRun) {
    console.log('')
    for (const record of records) {
      console.log(
        `  Would restore ${record.id} (${record.targets.join(', ')} @ global)`,
      )
    }
    console.log('')
    p.outro(
      `Dry run: ${records.length} global installation(s) would be restored`,
    )
    return true
  }

  const spinner = p.spinner()
  spinner.start('Restoring...')

  const installOptions: InstallOptions = { scope: 'global' }
  let restoredCount = 0
  let restoredTargetCount = 0
  let hadFailures = false

  const sourceConfigs = new Map(
    config.sources.map((source) => [source.name, source] as const),
  )
  const skillsBySource = new Map<
    string,
    Map<
      string,
      Awaited<ReturnType<typeof providerRegistry.discoverAll>>[number]
    >
  >()

  for (const sourceName of new Set(records.map((record) => record.source))) {
    const sourceConfig = sourceConfigs.get(sourceName)
    if (!sourceConfig) {
      hadFailures = true
      p.log.warn(`Skipped source ${sourceName}: source config not found`)
      continue
    }

    const enabledSourceConfig = sourceConfig.enabled
      ? sourceConfig
      : { ...sourceConfig, enabled: true }

    try {
      await providerRegistry.sync(enabledSourceConfig)
      const skills = await providerRegistry.discoverAll([enabledSourceConfig])
      skillsBySource.set(
        sourceName,
        new Map(skills.map((skill) => [skill.id, skill] as const)),
      )
    } catch (error) {
      hadFailures = true
      p.log.warn(
        `Failed to prepare source ${sourceName}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  for (const record of records) {
    spinner.message(`Restoring ${record.id}...`)

    const sourceConfig = sourceConfigs.get(record.source)
    if (!sourceConfig) {
      hadFailures = true
      continue
    }

    const skill = skillsBySource.get(record.source)?.get(record.id)
    if (!skill) {
      hadFailures = true
      p.log.warn(
        `Skipped ${record.id}: skill metadata not found in ${record.source}`,
      )
      continue
    }

    let content: SkillContent
    try {
      content = await providerRegistry.fetchContent(skill, sourceConfig)
    } catch (error) {
      hadFailures = true
      p.log.warn(
        `Failed to fetch ${record.id} from ${record.source}: ${error instanceof Error ? error.message : String(error)}`,
      )
      continue
    }

    const successfulTargets: string[] = []
    for (const targetName of record.targets) {
      const target = targetRegistry.get(targetName)
      if (!target) {
        hadFailures = true
        p.log.warn(`Skipped ${record.id}: target not found: ${targetName}`)
        continue
      }

      try {
        await target.install(content, installOptions)
        const verified = await isSkillInstalledInTarget(
          target,
          record.id,
          installOptions,
        )
        if (!verified) {
          hadFailures = true
          p.log.warn(
            `Restore verification failed for ${record.id} on ${targetName}: target did not report the skill after install`,
          )
          continue
        }

        successfulTargets.push(targetName)
      } catch (error) {
        hadFailures = true
        p.log.warn(
          `Failed to restore ${record.id} to ${targetName}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    if (successfulTargets.length === 0) {
      continue
    }

    restoredCount++
    restoredTargetCount += successfulTargets.length
    p.log.success(
      `Restored ${record.id} (${successfulTargets.join(', ')} @ global)`,
    )
  }

  if (hadFailures) {
    spinner.stop(
      `Restored ${restoredCount} global installation(s) to ${restoredTargetCount} target(s) with errors`,
    )
    p.outro('Failed')
    return false
  }

  spinner.stop(
    `Restored ${restoredCount} global installation(s) to ${restoredTargetCount} target(s)`,
  )
  p.outro('Done')
  return true
}
