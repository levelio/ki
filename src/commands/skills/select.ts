import * as p from '@clack/prompts'
import type { CliFlags, TargetConfig } from '../../types'
import { type InstalledRecord, formatRecordLabel, getRecordKey } from '../../installed'

interface SkillOption {
  id: string
}

export async function selectInstallSkillIds(
  skills: SkillOption[],
  nonInteractive: boolean,
  hasExplicitTarget: boolean
): Promise<string[] | null> {
  if (nonInteractive && skills.length === 1 && hasExplicitTarget) {
    return [skills[0].id]
  }

  const selectedSkills = await p.autocompleteMultiselect({
    message: 'Select skills to install (type to search)',
    options: skills.map(skill => ({
      value: skill.id,
      label: skill.id,
    })),
    required: true
  })

  if (p.isCancel(selectedSkills)) {
    return null
  }

  return selectedSkills as string[]
}

export async function selectInstallTargets(
  enabledTargets: TargetConfig[],
  flags: CliFlags,
  nonInteractive: boolean
): Promise<string[] | null> {
  const explicitTargets = typeof flags['t'] === 'string'
    ? flags['t']
    : typeof flags['target'] === 'string'
      ? flags['target']
      : undefined

  if (explicitTargets) {
    return explicitTargets.split(',').map(target => target.trim())
  }

  if (nonInteractive) {
    return enabledTargets.filter(target => target.enabled).map(target => target.name)
  }

  const selected = await p.autocompleteMultiselect({
    message: 'Select targets (type to search)',
    options: enabledTargets
      .filter(target => target.enabled)
      .map(target => ({
        value: target.name,
        label: target.name
      })),
    required: true
  })

  if (p.isCancel(selected)) {
    return null
  }

  return selected as string[]
}

export async function selectUninstallRecords(
  records: InstalledRecord[],
  nonInteractive: boolean
): Promise<InstalledRecord[] | null> {
  if (nonInteractive && records.length === 1) {
    return [records[0]]
  }

  if (nonInteractive) {
    return null
  }

  const selected = await p.autocompleteMultiselect({
    message: 'Select skills to uninstall (type to search)',
    options: records.map(record => ({
      value: getRecordKey(record),
      label: formatRecordLabel(record),
    })),
    required: true
  })

  if (p.isCancel(selected)) {
    return null
  }

  const selectedKeys = new Set(selected as string[])
  return records.filter(record => selectedKeys.has(getRecordKey(record)))
}

export async function selectUninstallTargets(
  records: InstalledRecord[],
  flags: CliFlags,
  nonInteractive: boolean
): Promise<string[] | null> {
  const explicitTargets = typeof flags['t'] === 'string'
    ? flags['t']
    : typeof flags['target'] === 'string'
      ? flags['target']
      : undefined

  if (explicitTargets) {
    return explicitTargets.split(',').map(target => target.trim())
  }

  const allTargets = [...new Set(records.flatMap(record => record.targets))]
  if (nonInteractive || allTargets.length === 1) {
    return allTargets
  }

  const selected = await p.autocompleteMultiselect({
    message: 'Select targets to uninstall from',
    options: allTargets.map(target => ({
      value: target,
      label: target
    })),
    required: true
  })

  if (p.isCancel(selected)) {
    return null
  }

  return selected as string[]
}
