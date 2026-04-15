import { existsSync, lstatSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import * as p from '@clack/prompts'
import { saveConfig } from '../config'
import {
  filterInstalledRecordsByScope,
  getInstalledRecordsForSkill,
  loadInstalled,
} from '../installed'
import { providerRegistry } from '../providers'
import type { CliFlags, Config, SkillMeta, SourceConfig } from '../types'
import { printSourceSkillInstallations } from './skills/display'

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

  return join(homedir(), '.config', 'ki', 'cache', cacheName)
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

function getEffectiveSourceOptions(
  source: SourceConfig,
): Record<string, unknown> & {
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
}

export async function sourceSync(
  config: Pick<Config, 'sources'>,
  sourceName?: string,
) {
  p.intro('Sync Sources')

  const spinner = p.spinner()
  spinner.start('Syncing...')

  const sourcesToSync = getSelectedEnabledSources(config, sourceName)
  if (sourceName && sourcesToSync.length === 0) {
    spinner.stop()
    p.log.error(`Source not found or disabled: ${sourceName}`)
    p.outro('Failed')
    return
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
}

export async function sourceSkills(
  config: Pick<Config, 'sources'>,
  sourceName?: string,
  flags: CliFlags = { _: [] },
) {
  p.intro(sourceName ? `Skills in ${sourceName}` : 'Skills by Source')

  const spinner = p.spinner()
  spinner.start('Loading skills...')

  const sourcesToQuery = getSelectedEnabledSources(config, sourceName)
  if (sourceName && sourcesToQuery.length === 0) {
    spinner.stop()
    p.log.error(`Source not found or disabled: ${sourceName}`)
    p.outro('Failed')
    return
  }

  const skills = await providerRegistry.discoverAll(sourcesToQuery)

  spinner.stop()

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
}

export async function sourceEnable(config: Config, sourceName: string) {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return
  }

  source.enabled = true
  await saveConfig(config)
  p.log.success(`Enabled source: ${sourceName}`)
}

export async function sourceAdd(
  config: Config,
  url: string,
  explicitName?: string,
  flags: CliFlags = { _: [] },
) {
  const source = detectSource(url)
  if (!source) {
    p.log.error(
      `Unsupported source. Use a git URL or an existing local directory: ${url}`,
    )
    return
  }

  const sourceName = explicitName || inferSourceName(source.url)
  if (findSource(config, sourceName)) {
    p.log.error(`Source already exists: ${sourceName}`)
    return
  }
  if (config.sources.some((existing) => existing.url === source.url)) {
    p.log.error(`Source URL already exists: ${source.url}`)
    return
  }

  const options = getSourceOptionUpdates(flags, source.provider)
  if (options === null) {
    return
  }

  const enabled = getSourceEnableUpdate(flags, true)
  if (enabled === undefined) {
    return
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
}

export async function sourceSet(
  config: Config,
  sourceName: string,
  flags: CliFlags,
) {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return
  }

  const options = getSourceOptionUpdates(flags, source.provider)
  if (options === null) {
    return
  }

  const enabled = getSourceEnableUpdate(flags, false)
  if (enabled === undefined) {
    return
  }

  const nextOptions = { ...(source.options || {}), ...options }
  if ('skillsPath' in options) {
    delete nextOptions.path
  }
  const hasOptionUpdates = Object.keys(options).length > 0
  const hasEnabledUpdate = enabled !== null
  if (!hasOptionUpdates && !hasEnabledUpdate) {
    p.log.error('No source changes specified')
    return
  }

  source.options =
    Object.keys(nextOptions).length > 0 ? nextOptions : undefined
  if (enabled !== null) {
    source.enabled = enabled
  }

  await saveConfig(config)
  p.log.success(`Updated source: ${sourceName}`)
}

export async function sourceUnset(
  config: Config,
  sourceName: string,
  flags: CliFlags,
) {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return
  }

  const unsetKeys = [
    flags.branch === true ? 'branch' : null,
    flags['skills-path'] === true ? 'skillsPath' : null,
    flags.structure === true ? 'structure' : null,
    flags['skill-file'] === true ? 'skillFile' : null,
  ].filter(Boolean) as string[]

  if (unsetKeys.length === 0) {
    p.log.error('No source options specified to unset')
    return
  }

  const nextOptions = { ...(source.options || {}) }
  for (const key of unsetKeys) {
    delete nextOptions[key]
  }
  if (flags['skills-path'] === true) {
    delete nextOptions.path
  }

  source.options =
    Object.keys(nextOptions).length > 0 ? nextOptions : undefined

  await saveConfig(config)
  p.log.success(`Unset source options: ${sourceName}`)
}

export async function sourceShow(
  config: Pick<Config, 'sources'>,
  sourceName: string,
) {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return
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
}

export async function sourceRemove(config: Config, sourceName: string) {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return
  }

  config.sources = config.sources.filter(
    (existing) => existing.name !== sourceName,
  )
  await saveConfig(config)
  p.log.warn(`Removed source: ${sourceName}`)
}

export async function sourceDisable(config: Config, sourceName: string) {
  const source = findSource(config, sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return
  }

  source.enabled = false
  await saveConfig(config)
  p.log.warn(`Disabled source: ${sourceName}`)
}
