import { existsSync, lstatSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { getKiCacheDir, saveConfig } from '../config'
import { isSkillInstalledInTarget } from '../installations'
import {
  type InstalledRecord,
  filterInstalledRecordsByScope,
  findInstalledRecordIndex,
  formatTargetsAtLocation,
  getInstalledRecordsForSkill,
  getRecordInstallOptions,
  getRecordKey,
  loadInstalled,
  saveInstalled,
} from '../installed'
import { providerRegistry } from '../providers'
import { targetRegistry } from '../targets'
import type {
  CliFlags,
  Config,
  InstallOptions,
  SkillContent,
  SkillMeta,
  SourceConfig,
} from '../types'
import * as p from '../ui'
import { printSourceSkillInstallations } from './skills/display'
import { selectInstallTargets } from './skills/select'
import { findSkillSourceConfig, getErrorMessage } from './skills/shared'

const VALID_STRUCTURES = new Set(['nested', 'flat'])

function getEnabledSources(config: Pick<Config, 'sources'>): SourceConfig[] {
  return config.sources.filter((source) => source.enabled)
}

function getSelectedEnabledSources(
  config: Pick<Config, 'sources'>,
  sourceName?: string,
): SourceConfig[] {
  if (!sourceName) {
    return getEnabledSources(config)
  }

  return getEnabledSources(config).filter(
    (source) => source.name === sourceName,
  )
}

function getExplicitOrEnabledTargets(
  targets: string[] | null,
  options: {
    allowUnavailable?: boolean
  } = {},
): string[] | false {
  if (!targets) {
    p.log.error(
      'Non-interactive command requires an explicit target when multiple enabled targets exist. Use -t/--target, or leave only one enabled target in config.',
    )
    p.outro('Failed')
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
  if (invalidTargets.length > 0 && !options.allowUnavailable) {
    p.log.error(`Unknown target(s): ${invalidTargets.join(', ')}`)
    p.outro('Failed')
    return false
  }

  return normalizedTargets
}

function findSource(
  config: Pick<Config, 'sources'>,
  sourceName: string,
): SourceConfig | undefined {
  return config.sources.find((source) => source.name === sourceName)
}

function isGitUrl(value: string): boolean {
  return (
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('git@')
  )
}

function normalizeLocalPath(value: string): string {
  const withoutScheme = value.replace(/^file:\/\//, '')
  const expandedHome =
    withoutScheme === '~'
      ? homedir()
      : withoutScheme.replace(/^~(?=\/)/, homedir())

  return resolve(expandedHome)
}

function detectSource(
  value: string,
): Pick<SourceConfig, 'provider' | 'url'> | null {
  if (isGitUrl(value)) {
    return {
      provider: 'git',
      url: value,
    }
  }

  const localPath = normalizeLocalPath(value)
  if (existsSync(localPath) && lstatSync(localPath).isDirectory()) {
    return {
      provider: 'local',
      url: localPath,
    }
  }

  return null
}

function inferSourceName(url: string): string {
  const normalized = url
    .replace(/\/$/, '')
    .replace(/\.git$/, '')
    .split(/[/:]/)
    .filter(Boolean)

  return normalized[normalized.length - 1] || 'source'
}

function getGitCachePath(url: string): string {
  const cacheName = url
    .replace(/^https?:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/[/:]/g, '-')
    .replace(/^-/, '')

  return join(getKiCacheDir(), cacheName)
}

function normalizeSkillsPath(
  value: string,
): string | string[] | { error: string } {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return { error: 'Please specify at least one path for --skills-path' }
  }

  return parts.length === 1 ? parts[0] : parts
}

function getSourceOptionUpdates(
  flags: CliFlags,
  provider: string,
): Record<string, unknown> | null {
  const options: Record<string, unknown> = {}

  if (typeof flags.branch === 'string') {
    if (provider !== 'git') {
      p.log.error('Option --branch is only supported for git sources')
      return null
    }
    options.branch = flags.branch
  }

  if (typeof flags['skills-path'] === 'string') {
    const normalized = normalizeSkillsPath(flags['skills-path'])
    if (typeof normalized === 'object' && 'error' in normalized) {
      p.log.error(normalized.error)
      return null
    }
    options.skillsPath = normalized
  }

  if (typeof flags.structure === 'string') {
    if (!VALID_STRUCTURES.has(flags.structure)) {
      p.log.error('Option --structure must be either "nested" or "flat"')
      return null
    }
    options.structure = flags.structure
  }

  if (typeof flags['skill-file'] === 'string') {
    options.skillFile = flags['skill-file']
  }

  return Object.keys(options).length > 0 ? options : {}
}

function getSourceEnableUpdate(
  flags: CliFlags,
  allowDisabled: boolean,
): boolean | null | undefined {
  const enable = Boolean(flags.enable)
  const disable = Boolean(flags.disable)
  const disabled = Boolean(flags.disabled)

  if (enable && disable) {
    p.log.error('Options --enable and --disable cannot be used together')
    return undefined
  }

  if (allowDisabled && disable && disabled) {
    p.log.error('Options --disable and --disabled cannot be used together')
    return undefined
  }

  if (enable) return true
  if (disable || (allowDisabled && disabled)) return false
  return null
}

function getEffectiveSourceOptions(source: SourceConfig): Record<
  string,
  unknown
> & {
  branch?: string
  skillsPath: string | string[]
  structure: string
  skillFile: string
} {
  const options = source.options || {}
  const effectiveSkillsPath =
    (options.skillsPath as string | string[] | undefined) ??
    (options.path as string | string[] | undefined) ??
    'skills'

  return {
    ...options,
    ...(source.provider === 'git'
      ? { branch: (options.branch as string) || 'main' }
      : {}),
    skillsPath: effectiveSkillsPath,
    structure: (options.structure as string) || 'nested',
    skillFile: (options.skillFile as string) || 'SKILL.md',
  }
}

function formatOptionValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => `    - ${String(item)}`)
  }

  if (typeof value === 'boolean') {
    return [`    ${value ? 'true' : 'false'}`]
  }

  return [`    ${String(value)}`]
}

function printOptionsBlock(
  label: string,
  options: Record<string, unknown> | undefined,
): void {
  console.log(`  ${label}:`)

  if (!options || Object.keys(options).length === 0) {
    console.log('    (none)')
    return
  }

  for (const [key, value] of Object.entries(options)) {
    console.log(`    ${key}:`)
    for (const line of formatOptionValue(value)) {
      console.log(line)
    }
  }
}

function pruneUndefinedOptions(
  options: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  )
}

export async function sourceList(config: Pick<Config, 'sources'>) {
  p.intro('Sources')

  for (const source of config.sources) {
    const icon = source.enabled ? '◉' : '◯'
    console.log(`  ${icon} ${source.name}`)
    console.log(`     Provider: ${source.provider}`)
    console.log(`     URL: ${source.url}`)
    console.log('')
  }

  p.outro(`${config.sources.length} source(s)`)
  return true
}

export async function sourceSync(
  config: Pick<Config, 'sources'>,
  sourceName?: string,
): Promise<boolean> {
  p.intro('Sync Sources')

  const spinner = p.spinner()
  spinner.start('Syncing...')

  const sourcesToSync = getSelectedEnabledSources(config, sourceName)
  if (sourceName && sourcesToSync.length === 0) {
    spinner.stop()
    p.log.error(`Source not found or disabled: ${sourceName}`)
    p.outro('Failed')
    return false
  }

  for (const source of sourcesToSync) {
    spinner.message(`Syncing ${source.name}...`)
    await providerRegistry.sync(source)
  }

  const skills = await providerRegistry.discoverAll(sourcesToSync)

  spinner.stop(
    `Synced ${sourcesToSync.length} source(s), found ${skills.length} skills`,
  )
  p.outro('Done')
  return true
}

export async function sourceSkills(
  config: Pick<Config, 'sources'>,
  sourceName?: string,
  flags: CliFlags = { _: [] },
): Promise<boolean> {
  p.intro(sourceName ? `Skills in ${sourceName}` : 'Skills by Source')

  const spinner = p.spinner()
  spinner.start('Loading skills...')

  const sourcesToQuery = getSelectedEnabledSources(config, sourceName)
  if (sourceName && sourcesToQuery.length === 0) {
    spinner.stop()
    p.log.error(`Source not found or disabled: ${sourceName}`)
    p.outro('Failed')
    return false
  }

  const skills = await providerRegistry.discoverAll(sourcesToQuery)

  spinner.stop()

  if (skills.length === 0) {
    p.note(
      sourceName
        ? `No skills found in ${sourceName}`
        : 'No skills found in enabled sources',
    )
    p.outro('0 skill(s)')
    return true
  }

  const bySource: Record<string, SkillMeta[]> = {}
  for (const skill of skills) {
    if (!bySource[skill._source]) {
      bySource[skill._source] = []
    }
    bySource[skill._source].push(skill)
  }

  const currentProjectPath = process.cwd()
  const installed = filterInstalledRecordsByScope(
    await loadInstalled(),
    flags,
    currentProjectPath,
  )

  for (const [source, sourceSkills] of Object.entries(bySource)) {
    if (sourceName && source !== sourceName) continue

    console.log(`\n  ${source} (${sourceSkills.length})`)
    for (const skill of sourceSkills) {
      const records = getInstalledRecordsForSkill(installed, skill.id)
      printSourceSkillInstallations(skill.id, records)
    }
  }

  console.log('')
  p.outro(`${skills.length} skill(s)`)
  return true
}

export async function sourceInstall(
  config: Pick<Config, 'sources' | 'targets'>,
  sourceName: string,
  flags: CliFlags = { _: [] },
): Promise<boolean> {
  p.intro(`Install Source: ${sourceName}`)

  const source = getSelectedEnabledSources(config, sourceName)[0]
  if (!source) {
    p.log.error(`Source not found or disabled: ${sourceName}`)
    p.outro('Failed')
    return false
  }

  const targets = getExplicitOrEnabledTargets(
    await selectInstallTargets(config.targets, flags, false),
  )
  if (targets === false) {
    return false
  }

  const skills = await providerRegistry.discoverAll([source])
  if (skills.length === 0) {
    p.note(`No skills found in ${sourceName}`)
    p.outro('Done')
    return true
  }

  const scope: 'global' | 'project' = flags.project ? 'project' : 'global'
  const installOptions: InstallOptions = flags.project
    ? { scope: 'project', projectPath: process.cwd() }
    : { scope: 'global' }

  if (flags['dry-run']) {
    console.log('')
    for (const skill of skills) {
      console.log(
        `  Would install ${skill.id} (${formatTargetsAtLocation(targets, installOptions)})`,
      )
    }
    console.log('')
    p.outro(
      `Dry run: ${skills.length} skill instance(s) would be installed from ${sourceName}`,
    )
    return true
  }

  const spinner = p.spinner()
  spinner.start('Installing...')

  const installed = await loadInstalled()
  let installedCount = 0
  let installedTargetCount = 0
  let hadFailures = false

  for (const skill of skills) {
    spinner.message(`Installing ${skill.id}...`)

    const sourceConfig = findSkillSourceConfig(config, skill)
    if (!sourceConfig) {
      hadFailures = true
      p.log.warn(
        `Skipped ${skill.id}: source config not found for ${skill._source}`,
      )
      continue
    }

    let content: SkillContent
    try {
      content = await providerRegistry.fetchContent(skill, sourceConfig)
    } catch (error) {
      hadFailures = true
      p.log.warn(
        `Skipped ${skill.id}: failed to fetch content: ${getErrorMessage(error)}`,
      )
      continue
    }
    const successfulTargets: string[] = []

    for (const targetName of targets) {
      const target = targetRegistry.get(targetName)
      if (!target) {
        hadFailures = true
        p.log.warn(`Skipped ${skill.id}: target not found: ${targetName}`)
        continue
      }

      try {
        await target.install(content, installOptions)
        const verified = await isSkillInstalledInTarget(
          target,
          skill.id,
          installOptions,
        )
        if (!verified) {
          hadFailures = true
          p.log.warn(
            `Install verification failed for ${skill.id} on ${targetName}: target did not report the skill after install`,
          )
          continue
        }

        successfulTargets.push(targetName)
      } catch (error) {
        hadFailures = true
        p.log.warn(
          `Failed to install ${skill.id} to ${targetName}: ${getErrorMessage(error)}`,
        )
      }
    }

    if (successfulTargets.length === 0) {
      hadFailures = true
      p.log.warn(
        `Skipped recording ${skill.id}: no targets installed successfully`,
      )
      continue
    }

    const existingIndex = findInstalledRecordIndex(installed, {
      id: skill.id,
      scope,
      projectPath:
        installOptions.scope === 'project'
          ? installOptions.projectPath
          : undefined,
    })
    const existingRecord = existingIndex >= 0 ? installed[existingIndex] : null
    const sharedRecordFields = {
      id: skill.id,
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
      `Installed ${skill.id} (${formatTargetsAtLocation(successfulTargets, record)})`,
    )
    installedCount++
    installedTargetCount += successfulTargets.length
  }

  await saveInstalled(installed)

  if (hadFailures) {
    spinner.stop(
      `Installed ${installedCount} skill instance(s) from ${sourceName} to ${installedTargetCount} target(s) with errors`,
    )
    p.outro('Failed')
    return false
  }

  spinner.stop(
    `Installed ${installedCount} skill instance(s) from ${sourceName} to ${installedTargetCount} target(s) in ${scope}`,
  )
  p.outro('Done')
  return true
}

export async function sourceUninstall(
  config: Pick<Config, 'sources'>,
  sourceName: string,
  flags: CliFlags = { _: [] },
): Promise<boolean> {
  p.intro(`Uninstall Source: ${sourceName}`)

  if (!findSource(config, sourceName)) {
    p.log.error(`Source not found: ${sourceName}`)
    p.outro('Failed')
    return false
  }

  const currentProjectPath = process.cwd()
  const allInstalled = await loadInstalled()
  const installed = filterInstalledRecordsByScope(
    allInstalled,
    flags,
    currentProjectPath,
  ).filter((record) => record.source === sourceName)

  if (installed.length === 0) {
    p.note(`No installed skills found for source: ${sourceName}`)
    p.outro('Done')
    return true
  }

  const explicitTargets =
    typeof flags.t === 'string'
      ? flags.t
      : typeof flags.target === 'string'
        ? flags.target
        : undefined
  const targets = getExplicitOrEnabledTargets(
    explicitTargets
      ? explicitTargets.split(',').map((target) => target.trim())
      : [...new Set(installed.flatMap((record) => record.targets))],
    { allowUnavailable: true },
  )
  if (targets === false) {
    return false
  }

  const spinner = p.spinner()
  spinner.start('Uninstalling...')

  const removedTargetsByRecord = new Map<string, Set<string>>()
  let hadFailures = false

  for (const record of installed) {
    const recordKey = getRecordKey(record)
    spinner.message(`Uninstalling ${record.id}...`)

    for (const targetName of targets) {
      if (!record.targets.includes(targetName)) continue

      const target = targetRegistry.get(targetName)
      if (!target) {
        let removedTargets = removedTargetsByRecord.get(recordKey)
        if (!removedTargets) {
          removedTargets = new Set<string>()
          removedTargetsByRecord.set(recordKey, removedTargets)
        }
        removedTargets.add(targetName)
        p.log.warn(
          `Removed install record for ${record.id} from ${targetName} without running a target uninstall because the target is unavailable`,
        )
        continue
      }

      try {
        await target.uninstall(record.id, getRecordInstallOptions(record))
        const stillInstalled = await isSkillInstalledInTarget(
          target,
          record.id,
          getRecordInstallOptions(record),
        )
        if (stillInstalled) {
          hadFailures = true
          p.log.warn(
            `Uninstall verification failed for ${record.id} on ${targetName}: target still reports the skill as installed`,
          )
          continue
        }

        let removedTargets = removedTargetsByRecord.get(recordKey)
        if (!removedTargets) {
          removedTargets = new Set<string>()
          removedTargetsByRecord.set(recordKey, removedTargets)
        }
        removedTargets.add(targetName)
      } catch (error) {
        hadFailures = true
        p.log.warn(
          `Failed to remove ${record.id} from ${targetName}: ${getErrorMessage(error)}`,
        )
      }
    }
  }

  const newInstalled = allInstalled
    .map((record) => {
      const removedTargets = removedTargetsByRecord.get(getRecordKey(record))
      if (!removedTargets || removedTargets.size === 0) {
        return record
      }

      const remainingTargets = record.targets.filter(
        (target) => !removedTargets.has(target),
      )
      if (remainingTargets.length === 0) {
        return null
      }

      return { ...record, targets: remainingTargets }
    })
    .filter(Boolean) as InstalledRecord[]

  await saveInstalled(newInstalled)

  const uninstalledCount = installed.filter((record) =>
    removedTargetsByRecord.has(getRecordKey(record)),
  ).length
  if (hadFailures) {
    spinner.stop(
      `Uninstalled ${uninstalledCount} skill instance(s) from ${sourceName} with errors`,
    )
    p.outro('Failed')
    return false
  }

  spinner.stop(
    `Uninstalled ${uninstalledCount} skill instance(s) from ${sourceName}`,
  )
  p.outro('Done')
  return true
}

export async function sourceEnable(config: Config, sourceName: string) {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return false
  }

  source.enabled = true
  await saveConfig(config)
  p.log.success(`Enabled source: ${sourceName}`)
  return true
}

export async function sourceAdd(
  config: Config,
  url: string,
  explicitName?: string,
  flags: CliFlags = { _: [] },
): Promise<boolean> {
  const source = detectSource(url)
  if (!source) {
    p.log.error(
      `Unsupported source. Use a git URL or an existing local directory: ${url}`,
    )
    return false
  }

  const sourceName = explicitName || inferSourceName(source.url)
  if (findSource(config, sourceName)) {
    p.log.error(`Source already exists: ${sourceName}`)
    return false
  }
  if (config.sources.some((existing) => existing.url === source.url)) {
    p.log.error(`Source URL already exists: ${source.url}`)
    return false
  }

  const options = getSourceOptionUpdates(flags, source.provider)
  if (options === null) {
    return false
  }

  const enabled = getSourceEnableUpdate(flags, true)
  if (enabled === undefined) {
    return false
  }

  config.sources.push({
    name: sourceName,
    provider: source.provider,
    url: source.url,
    ...(options && Object.keys(options).length > 0 ? { options } : {}),
    enabled: enabled ?? true,
  })

  await saveConfig(config)
  p.log.success(`Added source: ${sourceName}`)
  return true
}

export async function sourceSet(
  config: Config,
  sourceName: string,
  flags: CliFlags,
): Promise<boolean> {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return false
  }

  const options = getSourceOptionUpdates(flags, source.provider)
  if (options === null) {
    return false
  }

  const enabled = getSourceEnableUpdate(flags, false)
  if (enabled === undefined) {
    return false
  }

  const nextOptions = { ...(source.options || {}), ...options }
  if ('skillsPath' in options) {
    nextOptions.path = undefined
  }
  const cleanedOptions = pruneUndefinedOptions(nextOptions)
  const hasOptionUpdates = Object.keys(options).length > 0
  const hasEnabledUpdate = enabled !== null
  if (!hasOptionUpdates && !hasEnabledUpdate) {
    p.log.error('No source changes specified')
    return false
  }

  source.options =
    Object.keys(cleanedOptions).length > 0 ? cleanedOptions : undefined
  if (enabled !== null) {
    source.enabled = enabled
  }

  await saveConfig(config)
  p.log.success(`Updated source: ${sourceName}`)
  return true
}

export async function sourceUnset(
  config: Config,
  sourceName: string,
  flags: CliFlags,
): Promise<boolean> {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return false
  }

  const unsetKeys = [
    flags.branch === true ? 'branch' : null,
    flags['skills-path'] === true ? 'skillsPath' : null,
    flags.structure === true ? 'structure' : null,
    flags['skill-file'] === true ? 'skillFile' : null,
  ].filter(Boolean) as string[]

  if (unsetKeys.length === 0) {
    p.log.error('No source options specified to unset')
    return false
  }

  const nextOptions = { ...(source.options || {}) }
  for (const key of unsetKeys) {
    delete nextOptions[key]
  }
  if (flags['skills-path'] === true) {
    nextOptions.path = undefined
  }
  const cleanedOptions = pruneUndefinedOptions(nextOptions)

  source.options =
    Object.keys(cleanedOptions).length > 0 ? cleanedOptions : undefined

  await saveConfig(config)
  p.log.success(`Unset source options: ${sourceName}`)
  return true
}

export async function sourceShow(
  config: Pick<Config, 'sources'>,
  sourceName: string,
): Promise<boolean> {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return false
  }

  const effectiveOptions = getEffectiveSourceOptions(source)
  const sourceRoot =
    source.provider === 'git' ? getGitCachePath(source.url) : source.url
  const resolvedSkillsPaths = Array.isArray(effectiveOptions.skillsPath)
    ? effectiveOptions.skillsPath.map((path) => join(sourceRoot, path))
    : [join(sourceRoot, effectiveOptions.skillsPath)]

  p.intro(`Source: ${sourceName}`)
  console.log(`  Provider: ${source.provider}`)
  console.log(`  URL: ${source.url}`)
  console.log(`  Enabled: ${source.enabled ? 'true' : 'false'}`)
  console.log('')
  printOptionsBlock('Options', source.options)
  console.log('')
  printOptionsBlock('Effective', effectiveOptions)
  console.log('')
  console.log('  Resolved:')
  console.log(`    sourceRoot: ${sourceRoot}`)
  console.log('    skillsPaths:')
  for (const path of resolvedSkillsPaths) {
    console.log(`      - ${path}`)
  }
  console.log('')
  p.outro('Done')
  return true
}

export async function sourceRemove(config: Config, sourceName: string) {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return false
  }

  config.sources = config.sources.filter(
    (existing) => existing.name !== sourceName,
  )
  await saveConfig(config)
  p.log.warn(`Removed source: ${sourceName}`)
  return true
}

export async function sourceDisable(config: Config, sourceName: string) {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return false
  }

  source.enabled = false
  await saveConfig(config)
  p.log.warn(`Disabled source: ${sourceName}`)
  return true
}
