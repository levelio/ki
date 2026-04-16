import {
  filterInstalledRecordsByScope,
  formatRecordLocation,
  formatTargetsAtLocation,
  getRecordInstallOptions,
  getRecordKey,
  loadInstalled,
  saveInstalled,
} from '../../installed'
import { providerRegistry } from '../../providers'
import { targetRegistry } from '../../targets'
import type { CliFlags, Config } from '../../types'
import * as p from '../../ui'
import {
  findSkillSourceConfig,
  getEnabledSources,
  getErrorMessage,
} from './shared'

export async function updateSkills(
  config: Pick<Config, 'sources'>,
  flags: CliFlags,
) {
  p.intro('Update Skills')
  const dryRun = Boolean(flags['dry-run'])

  const currentProjectPath = process.cwd()
  const allInstalled = await loadInstalled()
  const installed = filterInstalledRecordsByScope(
    allInstalled,
    flags,
    currentProjectPath,
  )
  const updatedRecords = new Set<string>()

  if (installed.length === 0) {
    p.note('No matching installed skills')
    p.outro('Done')
    return
  }

  const spinner = p.spinner()
  spinner.start('Checking for updates...')

  const enabledSources = getEnabledSources(config)
  for (const source of enabledSources) {
    await providerRegistry.sync(source)
  }

  const skills = await providerRegistry.discoverAll(enabledSources)
  let updated = 0
  const pendingUpdates: string[] = []

  for (const record of installed) {
    const skill = skills.find((s) => s.id === record.id)
    if (!skill) continue

    const sourceConfig = findSkillSourceConfig(config, skill)
    if (!sourceConfig) {
      p.log.warn(
        `Skipped ${record.id} (${formatRecordLocation(record)}): source config not found for ${skill._source}`,
      )
      continue
    }
    const content = await providerRegistry.fetchContent(skill, sourceConfig)

    if (content.checksum !== record.checksum) {
      if (dryRun) {
        pendingUpdates.push(
          `${record.id} (${formatTargetsAtLocation(record.targets, record)})`,
        )
        continue
      }

      spinner.message(
        `Updating ${record.id} (${formatRecordLocation(record)})...`,
      )
      let didUpdate = false
      const updatedTargets: string[] = []

      for (const targetName of record.targets) {
        const target = targetRegistry.get(targetName)
        if (!target) continue

        const installOptions = getRecordInstallOptions(record)

        try {
          await target.install(content, installOptions)
          didUpdate = true
          updatedTargets.push(targetName)
        } catch (error) {
          p.log.warn(
            `Failed to update ${record.id} (${formatRecordLocation(record)}) for ${targetName}: ${getErrorMessage(error)}`,
          )
        }
      }

      if (didUpdate) {
        record.checksum = content.checksum
        record.installedAt = new Date().toISOString()
        updatedRecords.add(getRecordKey(record))
        updated = updatedRecords.size
        p.log.success(
          `Updated ${record.id} (${formatTargetsAtLocation(updatedTargets, record)})`,
        )
      }
    }
  }

  if (dryRun) {
    if (pendingUpdates.length === 0) {
      spinner.stop('All matching installations are up to date')
      p.outro('Dry run complete')
      return
    }

    spinner.stop(`Found ${pendingUpdates.length} installation(s) with updates`)
    console.log('')
    for (const entry of pendingUpdates) {
      console.log(`  Would update ${entry}`)
    }
    console.log('')
    p.outro('Dry run complete')
    return
  }

  await saveInstalled(allInstalled)

  if (updated === 0) {
    spinner.stop('All matching installations are up to date')
  } else {
    spinner.stop(`Updated ${updated} installation(s)`)
  }

  p.outro('Done')
}
