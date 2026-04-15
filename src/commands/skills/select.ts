import * as p from '@clack/prompts'
import {
  type InstalledRecord,
} from '../../installed'
import type { CliFlags, TargetConfig } from '../../types'

interface SkillOption {
  id: string
}

export async function selectInstallSkillIds(
  skills: SkillOption[],
  interactive: boolean,
): Promise<string[] | null> {
  if (!interactive) {
    if (skills.length !== 1) {
      return null
    }
    return [skills[0].id]
  }

  const selectedSkills = await p.autocompleteMultiselect({
    message: 'Select skills to install (type to search)',
    options: skills.map((skill) => ({
      value: skill.id,
      label: skill.id,
    })),
    required: true,
  })

  if (p.isCancel(selectedSkills)) {
    return null
  }

  return selectedSkills as string[]
}

export async function selectInstallTargets(
  enabledTargets: TargetConfig[],
  flags: CliFlags,
  interactive: boolean,
): Promise<string[] | null> {
  const explicitTargets =
    typeof flags.t === 'string'
      ? flags.t
      : typeof flags.target === 'string'
        ? flags.target
        : undefined

  if (explicitTargets) {
    return explicitTargets.split(',').map((target) => target.trim())
  }

  const availableTargets = enabledTargets
    .filter((target) => target.enabled)
    .map((target) => target.name)

  if (!interactive) {
    if (availableTargets.length <= 1) {
      return availableTargets
    }
    return null
  }

  const selected = await p.autocompleteMultiselect({
    message: 'Select targets (type to search)',
    options: availableTargets.map((targetName) => ({
      value: targetName,
      label: targetName,
    })),
    required: true,
  })

  if (p.isCancel(selected)) {
    return null
  }

  return selected as string[]
}

export async function selectUninstallRecords(
  records: InstalledRecord[],
): Promise<InstalledRecord[] | null> {
  if (records.length === 1) {
    return [records[0]]
  }
  return null
}

export async function selectUninstallTargets(
  records: InstalledRecord[],
  flags: CliFlags,
): Promise<string[] | null> {
  const explicitTargets =
    typeof flags.t === 'string'
      ? flags.t
      : typeof flags.target === 'string'
        ? flags.target
        : undefined

  if (explicitTargets) {
    return explicitTargets.split(',').map((target) => target.trim())
  }

  const allTargets = [...new Set(records.flatMap((record) => record.targets))]
  if (allTargets.length === 1) {
    return allTargets
  }
  return null
}
