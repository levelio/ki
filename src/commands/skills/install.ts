import * as p from '@clack/prompts'
import {
  type InstalledRecord,
  findInstalledRecordIndex,
  formatTargetsAtLocation,
  loadInstalled,
  saveInstalled,
} from '../../installed'
import { providerRegistry } from '../../providers'
import { targetRegistry } from '../../targets'
import type { CliFlags, Config, InstallOptions } from '../../types'
import { selectInstallSkillIds, selectInstallTargets } from './select'
import {
  findSkillSourceConfig,
  getEnabledSources,
  getErrorMessage,
} from './shared'

export async function installSkill(
  config: Pick<Config, 'sources' | 'targets'>,
  flags: CliFlags,
) {
  const searchQuery = flags._?.[0]
  const nonInteractive = Boolean(flags.y || flags.yes)
  const dryRun = Boolean(flags['dry-run'])

  p.intro(searchQuery ? `Install Skill: ${searchQuery}` : 'Install Skill')

  const enabledSources = getEnabledSources(config)
  const skills = await providerRegistry.discoverAll(enabledSources)

  if (skills.length === 0) {
    p.note('No skills available. Add sources first.')
    p.outro('Done')
    return
  }

  let filteredSkills = skills
  if (searchQuery) {
    const exactMatch = skills.find((s) => s.id === searchQuery)
    if (exactMatch) {
      filteredSkills = [exactMatch]
    } else {
      const query = searchQuery.toLowerCase()
      filteredSkills = skills.filter(
        (s) =>
          s.id.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query),
      )
      if (filteredSkills.length === 0) {
        p.log.error(`No skills matching: ${searchQuery}`)
        p.outro('Failed')
        return
      }
    }
  }

  const skillIds = await selectInstallSkillIds(
    filteredSkills,
    nonInteractive,
    Boolean(flags.t || flags.target),
  )
  if (!skillIds) {
    p.outro('Cancelled')
    return
  }

  const targets = await selectInstallTargets(
    config.targets,
    flags,
    nonInteractive,
  )
  if (!targets) {
    p.outro('Cancelled')
    return
  }
  if (targets.length === 0) {
    p.log.error(
      'No enabled targets. Specify with -t or enable targets in config.',
    )
    p.outro('Failed')
    return
  }

  const scope: 'global' | 'project' = flags.project ? 'project' : 'global'
  const installOptions: InstallOptions = flags.project
    ? { scope: 'project', projectPath: process.cwd() }
    : { scope: 'global' }
  const installLocation = installOptions

  if (dryRun) {
    console.log('')
    for (const skillId of skillIds) {
      console.log(
        `  Would install ${skillId} (${formatTargetsAtLocation(targets, installLocation)})`,
      )
    }
    console.log('')
    p.outro(`Dry run: ${skillIds.length} skill instance(s) would be installed`)
    return
  }

  const spinner = p.spinner()
  spinner.start('Installing...')

  const installed = await loadInstalled()
  let installedCount = 0
  let installedTargetCount = 0

  for (const skillId of skillIds) {
    const skill = skills.find((s) => s.id === skillId)
    if (!skill) continue

    spinner.message(`Installing ${skillId}...`)

    const sourceConfig = findSkillSourceConfig(config, skill)
    if (!sourceConfig) {
      p.log.warn(
        `Skipped ${skillId}: source config not found for ${skill._source}`,
      )
      continue
    }
    const content = await providerRegistry.fetchContent(skill, sourceConfig)
    const successfulTargets: string[] = []

    for (const targetName of targets) {
      const target = targetRegistry.get(targetName)
      if (!target) continue

      try {
        await target.install(content, installOptions)
        successfulTargets.push(targetName)
      } catch (error) {
        p.log.warn(
          `Failed to install ${skillId} to ${targetName}: ${getErrorMessage(error)}`,
        )
      }
    }

    if (successfulTargets.length === 0) {
      p.log.warn(
        `Skipped recording ${skillId}: no targets installed successfully`,
      )
      continue
    }

    const existingIndex = findInstalledRecordIndex(installed, {
      id: skillId,
      scope,
      projectPath:
        installOptions.scope === 'project'
          ? installOptions.projectPath
          : undefined,
    })
    const existingRecord = existingIndex >= 0 ? installed[existingIndex] : null
    const sharedRecordFields = {
      id: skillId,
      source: skill._source,
      targets: existingRecord
        ? [...new Set([...existingRecord.targets, ...successfulTargets])]
        : successfulTargets,
      checksum: content.checksum,
      installedAt: new Date().toISOString(),
      enabled: true,
    }
    const record: InstalledRecord =
      installOptions.scope === 'project'
        ? {
            ...sharedRecordFields,
            scope: 'project',
            projectPath: installOptions.projectPath,
          }
        : { ...sharedRecordFields, scope: 'global' }

    if (existingIndex >= 0) {
      installed[existingIndex] = record
    } else {
      installed.push(record)
    }

    p.log.success(
      `Installed ${skillId} (${formatTargetsAtLocation(successfulTargets, record)})`,
    )
    installedCount++
    installedTargetCount += successfulTargets.length
  }

  await saveInstalled(installed)

  spinner.stop(
    `Installed ${installedCount} skill instance(s) to ${installedTargetCount} target(s) in ${scope}`,
  )
  p.outro('Done')
}
