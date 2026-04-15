import * as p from '@clack/prompts'
import {
  type InstalledRecord,
  filterInstalledRecordsByScope,
  getRecordInstallOptions,
  getRecordKey,
  loadInstalled,
  saveInstalled,
} from '../../installed'
import { targetRegistry } from '../../targets'
import type { CliFlags } from '../../types'
import { selectUninstallRecords, selectUninstallTargets } from './select'

export async function uninstallSkill(flags: CliFlags) {
  const searchQuery = flags._?.[0]
  const interactive = Boolean(flags.interactive)
  const currentProjectPath = process.cwd()

  p.intro(searchQuery ? `Uninstall: ${searchQuery}` : 'Uninstall Skill')

  if (interactive) {
    p.log.error(
      'Interactive uninstall is not supported. Use an exact skill id, target, and scope.',
    )
    p.outro('Failed')
    return
  }

  const installed = await loadInstalled()

  if (installed.length === 0) {
    p.note('No skills installed')
    p.outro('Done')
    return
  }

  let filtered = filterInstalledRecordsByScope(
    installed,
    flags,
    currentProjectPath,
  )
  if (!searchQuery) {
    p.log.error(
      'Non-interactive uninstall requires an exact skill id, target, and scope.',
    )
    p.outro('Failed')
    return
  }

  const exactMatches = filtered.filter((r) => r.id === searchQuery)
  if (exactMatches.length > 0) {
    filtered = exactMatches
  } else {
    p.log.error(
      `Non-interactive uninstall requires an exact skill id. No installed skill matches: ${searchQuery}`,
    )
    p.outro('Failed')
    return
  }

  const selectedRecords = await selectUninstallRecords(filtered)
  if (!selectedRecords) {
    p.log.error(
      'Non-interactive uninstall requires exactly one matching installation. Use an exact skill id and add --global or run from the target project with --project.',
    )
    p.outro('Failed')
    return
  }

  const targets = await selectUninstallTargets(selectedRecords, flags)
  if (!targets) {
    p.log.error(
      'Non-interactive uninstall requires an explicit target when a matching installation exists in multiple targets. Use -t or --target.',
    )
    p.outro('Failed')
    return
  }

  const spinner = p.spinner()
  spinner.start('Uninstalling...')
  const removedTargetsByRecord = new Map<string, Set<string>>()

  for (const record of selectedRecords) {
    const recordKey = getRecordKey(record)
    const skillId = record.id

    spinner.message(`Uninstalling ${skillId}...`)

    for (const targetName of targets) {
      if (!record.targets.includes(targetName)) continue

      const target = targetRegistry.get(targetName)
      const installOptions = getRecordInstallOptions(record)

      if (!target) {
        let removedTargets = removedTargetsByRecord.get(recordKey)
        if (!removedTargets) {
          removedTargets = new Set<string>()
          removedTargetsByRecord.set(recordKey, removedTargets)
        }
        removedTargets.add(targetName)
        p.log.warn(
          `Removed install record for ${skillId} from ${targetName} without running a target uninstall because the target is unavailable`,
        )
        continue
      }

      try {
        await target.uninstall(skillId, installOptions)
        let removedTargets = removedTargetsByRecord.get(recordKey)
        if (!removedTargets) {
          removedTargets = new Set<string>()
          removedTargetsByRecord.set(recordKey, removedTargets)
        }
        removedTargets.add(targetName)
      } catch {
        p.log.warn(`Failed to remove from ${targetName}`)
      }
    }
  }

  const newInstalled = installed
    .map((r) => {
      const recordKey = getRecordKey(r)
      const removedTargets = removedTargetsByRecord.get(recordKey)
      if (!removedTargets || removedTargets.size === 0) {
        return r
      }

      const remainingTargets = r.targets.filter((t) => !removedTargets.has(t))
      if (remainingTargets.length === 0) {
        return null
      }
      return { ...r, targets: remainingTargets }
    })
    .filter(Boolean) as InstalledRecord[]

  await saveInstalled(newInstalled)

  spinner.stop('Done')
  p.outro(`Uninstalled ${selectedRecords.length} installation(s)`)
}
