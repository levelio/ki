import { isSkillInstalledInTarget } from '../../installations'
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
import * as p from '../../ui'
import { selectInstallSkillIds, selectInstallTargets } from './select'
import {
  findSkillSourceConfig,
  getEnabledSources,
  getErrorMessage,
} from './shared'

export async function installSkill(
  config: Pick<Config, 'sources' | 'targets'>,
  flags: CliFlags,
): Promise<boolean> {
  const searchQuery = flags._?.[0]
  const interactive = Boolean(flags.interactive)
  const dryRun = Boolean(flags['dry-run'])

  p.intro(searchQuery ? `Install Skill: ${searchQuery}` : 'Install Skill')

  if (interactive && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    p.log.error(
      'Interactive mode requires a TTY. Use ki search to find an exact skill id, then run ki install without -i/--interactive.',
    )
    p.outro('Failed')
    return false
  }

  const enabledSources = getEnabledSources(config)
  const skills = await providerRegistry.discoverAll(enabledSources)

  if (skills.length === 0) {
    p.note('No skills available. Add sources first.')
    p.outro('Done')
    return true
  }

  let filteredSkills = skills
  let exactSkillId: string | null = null
  if (searchQuery) {
    const exactMatch = skills.find((s) => s.id === searchQuery)
    if (exactMatch) {
      filteredSkills = [exactMatch]
      exactSkillId = exactMatch.id
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
        return false
      }
    }
  }

  const skillIds = interactive
    ? await selectInstallSkillIds(filteredSkills, true)
    : exactSkillId
      ? [exactSkillId]
      : null
  if (!skillIds) {
    if (interactive) {
      p.outro('Cancelled')
      return false
    }

    if (searchQuery) {
      p.log.error(
        `Non-interactive install requires an exact skill id. Run ki search ${searchQuery} or use ki install ${searchQuery} -i.`,
      )
    } else {
      p.log.error(
        'Non-interactive install requires an exact skill id. Run ki list, ki search <query>, or use ki install -i.',
      )
    }
    p.outro('Failed')
    return false
  }

  const targets = await selectInstallTargets(config.targets, flags, interactive)
  if (!targets) {
    if (interactive) {
      p.outro('Cancelled')
    } else {
      p.log.error(
        'Non-interactive install requires an explicit target when multiple enabled targets exist. Use -t/--target, or leave only one enabled target in config.',
      )
      p.outro('Failed')
    }
    return false
  }
  const normalizedTargets = [
    ...new Set(targets.map((target) => target.trim())),
  ].filter(Boolean)

  if (normalizedTargets.length === 0) {
    p.log.error(
      'No enabled targets. Specify with -t or enable targets in config.',
    )
    p.outro('Failed')
    return false
  }

  const invalidTargets = normalizedTargets.filter(
    (targetName) => !targetRegistry.get(targetName),
  )
  if (invalidTargets.length > 0) {
    p.log.error(`Unknown target(s): ${invalidTargets.join(', ')}`)
    p.outro('Failed')
    return false
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
        `  Would install ${skillId} (${formatTargetsAtLocation(normalizedTargets, installLocation)})`,
      )
    }
    console.log('')
    p.outro(`Dry run: ${skillIds.length} skill instance(s) would be installed`)
    return true
  }

  const spinner = p.spinner()
  spinner.start('Installing...')

  const installed = await loadInstalled()
  let installedCount = 0
  let installedTargetCount = 0
  let hadFailures = false

  for (const skillId of skillIds) {
    const skill = skills.find((s) => s.id === skillId)
    if (!skill) {
      hadFailures = true
      p.log.warn(`Skipped ${skillId}: skill metadata not found`)
      continue
    }

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

    for (const targetName of normalizedTargets) {
      const target = targetRegistry.get(targetName)
      if (!target) {
        hadFailures = true
        p.log.warn(`Skipped ${skillId}: target not found: ${targetName}`)
        continue
      }

      try {
        await target.install(content, installOptions)
        const verified = await isSkillInstalledInTarget(
          target,
          skillId,
          installOptions,
        )
        if (!verified) {
          hadFailures = true
          p.log.warn(
            `Install verification failed for ${skillId} on ${targetName}: target did not report the skill after install`,
          )
          continue
        }

        successfulTargets.push(targetName)
      } catch (error) {
        hadFailures = true
        p.log.warn(
          `Failed to install ${skillId} to ${targetName}: ${getErrorMessage(error)}`,
        )
      }
    }

    if (successfulTargets.length === 0) {
      hadFailures = true
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

  if (hadFailures) {
    spinner.stop(
      `Installed ${installedCount} skill instance(s) to ${installedTargetCount} target(s) with errors`,
    )
    p.outro('Failed')
    return false
  }

  spinner.stop(
    `Installed ${installedCount} skill instance(s) to ${installedTargetCount} target(s) in ${scope}`,
  )
  p.outro('Done')
  return true
}
