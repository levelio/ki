import { existsSync, lstatSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
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

  config.sources.push({
    name: sourceName,
    provider: source.provider,
    url: source.url,
    enabled: true,
  })

  await saveConfig(config)
  p.log.success(`Added source: ${sourceName}`)
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
