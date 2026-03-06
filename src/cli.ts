#!/usr/bin/env bun
import * as p from '@clack/prompts'
import * as YAML from 'yaml'
import { loadConfig, saveConfig, CONFIG_FILE } from './config'
import { providerRegistry } from './providers'
import { targetRegistry } from './targets'
import { existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { computeFileChecksum } from './utils'
import { DEFAULT_CONFIG } from './types'

const VERSION = '0.1.3'

// Data paths
const DATA_DIR = join(homedir(), '.config', 'ki')
const INSTALLED_FILE = join(DATA_DIR, 'installed.json')

interface InstalledRecord {
  id: string
  source: string
  targets: string[]
  scope: 'global' | 'project'
  checksum: string
  installedAt: string
  enabled: boolean
}

async function loadInstalled(): Promise<InstalledRecord[]> {
  if (!existsSync(INSTALLED_FILE)) return []
  try {
    const content = await readFile(INSTALLED_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

async function saveInstalled(records: InstalledRecord[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(INSTALLED_FILE, JSON.stringify(records, null, 2))
}

function parseFlags(args: string[]): Record<string, any> {
  const result: Record<string, any> = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result[key] = args[++i]
      } else {
        result[key] = true
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result[key] = args[++i]
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

function showHelp() {
  console.log(`
ki v${VERSION} - Cross-tool Skill Manager

Usage:
  ki <command> [options]

Commands:
  init                  Initialize config file with defaults
  list, ls              List all available skills
  install [search]      Install skill(s) - interactive multi-select
  uninstall [search]    Uninstall skill(s) - interactive multi-select
  update                Update all installed skills
  source <cmd>          Manage sources
  target <cmd>          Manage targets

Source Commands:
  ki source list           List all sources
  ki source sync [name]    Sync all sources or a specific source
  ki source skills [name]  List skills in a specific source

Target Commands:
  ki target list     List all targets

Options:
  --installed           Filter installed skills only
  --source <name>       Filter by source
  --global              Install to global scope (default)
  --project             Install to project scope
  -t, --target <list>   Comma-separated target list
  -y, --yes             Skip interactive prompts (non-interactive mode)
  --version, -v         Show version
  --help, -h            Show this help

Examples:
  ki init                        Initialize config file
  ki list                        List all skills
  ki list --installed            List installed skills
  ki install                     Interactive multi-select
  ki install brainstorming       Search + multi-select
  ki install superpowers:brainstorming -t claude-code -y  Direct install (non-interactive)
  ki uninstall                   Interactive multi-select
  ki update                      Update all installed skills
  ki source sync                 Sync all sources
`)
}

// ============ Init Command ============

async function initConfig() {
  p.intro('Initialize Config')

  const configPath = join(homedir(), '.config', 'ki', 'config.yaml')

  if (existsSync(configPath)) {
    const overwrite = await p.confirm({
      message: 'Config file already exists. Overwrite?',
      initialValue: false
    })

    if (!overwrite || p.isCancel(overwrite)) {
      p.outro('Cancelled')
      return
    }
  }

  const spinner = p.spinner()
  spinner.start('Creating config file...')

  await saveConfig(DEFAULT_CONFIG)

  spinner.stop('Done')
  p.outro(`Config file created at ${configPath}`)
}

// ============ List Command ============

async function listSkills(config: any, flags: Record<string, any>) {
  p.intro('Skill List')

  const spinner = p.spinner()
  spinner.start('Loading skills...')

  const enabledSources = config.sources.filter((s: any) => s.enabled)
  const skills = await providerRegistry.discoverAll(enabledSources)
  const installed = await loadInstalled()

  spinner.stop(`Found ${skills.length} skills`)

  // Filter
  let filtered = skills
  if (flags['installed']) {
    filtered = filtered.filter(s => {
      const record = installed.find(r => r.id === s.id)
      return !!record
    })
  }
  if (flags['source']) {
    filtered = filtered.filter(s => s._source === flags['source'])
  }
  if (flags._.length > 0) {
    const query = flags._[0].toLowerCase()
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query)
    )
  }

  if (filtered.length === 0) {
    p.note('No skills found matching criteria')
    p.outro('Done')
    return
  }

  // Display
  console.log('')
  for (const skill of filtered) {
    const record = installed.find(r => r.id === skill.id)
    const icon = record
      ? (record.enabled ? '✅' : '⏸️')
      : '⬜'
    const targets = record && record.targets.length > 0
      ? ` (${record.targets.join(', ')})`
      : ''
    console.log(`  ${icon} ${skill.id}${targets}`)
  }
  console.log('')
  p.outro(`${filtered.length} skill(s)`)
}

// ============ Install Command ============

async function installSkill(config: any, flags: Record<string, any>) {
  const searchQuery = flags._[0]
  const nonInteractive = flags['y'] || flags['yes']

  p.intro(searchQuery ? `Install Skill: ${searchQuery}` : 'Install Skill')

  // Load skills
  const enabledSources = config.sources.filter((s: any) => s.enabled)
  const skills = await providerRegistry.discoverAll(enabledSources)

  if (skills.length === 0) {
    p.note('No skills available. Add sources first.')
    p.outro('Done')
    return
  }

  // Filter by search query
  let filteredSkills = skills
  if (searchQuery) {
    // Check if it's an exact skill ID
    const exactMatch = skills.find(s => s.id === searchQuery)
    if (exactMatch) {
      filteredSkills = [exactMatch]
    } else {
      // Filter by search term
      const query = searchQuery.toLowerCase()
      filteredSkills = skills.filter(s =>
        s.id.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query)
      )
      if (filteredSkills.length === 0) {
        p.log.error(`No skills matching: ${searchQuery}`)
        p.outro('Failed')
        return
      }
    }
  }

  // Determine skill IDs to install
  let skillIds: string[]

  // Non-interactive mode: if exact match found and target specified, skip prompts
  if (nonInteractive && filteredSkills.length === 1 && (flags['t'] || flags['target'])) {
    skillIds = [filteredSkills[0].id]
  } else {
    // Interactive multi-select with search
    const selectedSkills = await p.autocompleteMultiselect({
      message: 'Select skills to install (type to search)',
      options: filteredSkills.map(s => ({
        value: s.id,
        label: s.id,
      })),
      required: true
    })

    if (p.isCancel(selectedSkills)) {
      p.outro('Cancelled')
      return
    }

    skillIds = selectedSkills as string[]
  }

  // Determine targets
  let targets: string[]
  if (flags['t'] || flags['target']) {
    targets = (flags['t'] || flags['target']).split(',').map((t: string) => t.trim())
  } else if (nonInteractive) {
    // In non-interactive mode without target, use all enabled targets
    targets = config.targets.filter((t: any) => t.enabled).map((t: any) => t.name)
    if (targets.length === 0) {
      p.log.error('No enabled targets. Specify with -t or enable targets in config.')
      p.outro('Failed')
      return
    }
  } else {
    const enabledTargets = config.targets.filter((t: any) => t.enabled)
    const selected = await p.autocompleteMultiselect({
      message: 'Select targets (type to search)',
      options: enabledTargets.map((t: any) => ({
        value: t.name,
        label: t.name
      })),
      required: true
    })

    if (p.isCancel(selected)) {
      p.outro('Cancelled')
      return
    }
    targets = selected as string[]
  }

  // Determine scope
  const scope: 'global' | 'project' = flags['project'] ? 'project' : 'global'

  // Install all selected skills
  const spinner = p.spinner()
  spinner.start('Installing...')

  const installed = await loadInstalled()

  for (const skillId of skillIds) {
    const skill = skills.find(s => s.id === skillId)
    if (!skill) continue

    spinner.message(`Installing ${skillId}...`)

    const sourceConfig = config.sources.find((s: any) => s.name === skill._source)
    const content = await providerRegistry.fetchContent(skill, sourceConfig)

    for (const targetName of targets) {
      const target = targetRegistry.get(targetName)
      if (!target) continue

      try {
        await target.install(content, { scope, projectPath: process.cwd() })
      } catch (error: any) {
        p.log.warn(`Failed to install ${skillId} to ${targetName}: ${error.message}`)
      }
    }

    // Update installed record
    const existingIndex = installed.findIndex(r => r.id === skillId)
    const record: InstalledRecord = {
      id: skillId,
      source: skill._source,
      targets,
      scope,
      checksum: content.checksum,
      installedAt: new Date().toISOString(),
      enabled: true
    }

    if (existingIndex >= 0) {
      installed[existingIndex] = record
    } else {
      installed.push(record)
    }
  }

  await saveInstalled(installed)

  spinner.stop('Done')
  p.outro(`Installed ${skillIds.length} skill(s) to ${targets.length} target(s)`)
}

// ============ Uninstall Command ============

async function uninstallSkill(flags: Record<string, any>) {
  const searchQuery = flags._[0]

  p.intro(searchQuery ? `Uninstall: ${searchQuery}` : 'Uninstall Skill')

  const installed = await loadInstalled()

  if (installed.length === 0) {
    p.note('No skills installed')
    p.outro('Done')
    return
  }

  // Filter by search query
  let filtered = installed
  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    filtered = installed.filter(r => r.id.toLowerCase().includes(query))
    if (filtered.length === 0) {
      p.log.error(`No installed skills matching: ${searchQuery}`)
      p.outro('Failed')
      return
    }
  }

  // Interactive multi-select with search
  const selected = await p.autocompleteMultiselect({
    message: 'Select skills to uninstall (type to search)',
    options: filtered.map(r => ({
      value: r.id,
      label: r.id,
    })),
    required: true
  })

  if (p.isCancel(selected)) {
    p.outro('Cancelled')
    return
  }

  const skillIds = selected as string[]

  const spinner = p.spinner()
  spinner.start('Uninstalling...')

  for (const skillId of skillIds) {
    const record = installed.find(r => r.id === skillId)
    if (!record) continue

    spinner.message(`Uninstalling ${skillId}...`)

    for (const targetName of record.targets) {
      const target = targetRegistry.get(targetName)
      if (!target) continue

      try {
        await target.uninstall(skillId, { scope: record.scope })
      } catch {
        p.log.warn(`Failed to remove from ${targetName}`)
      }
    }
  }

  // Remove from installed records
  const newInstalled = installed.filter(r => !skillIds.includes(r.id))
  await saveInstalled(newInstalled)

  spinner.stop('Done')
  p.outro(`Uninstalled ${skillIds.length} skill(s)`)
}

// ============ Enable/Disable Commands ============

// ============ Update Command ============

async function updateSkills(config: any) {
  p.intro('Update Skills')

  const installed = await loadInstalled()

  if (installed.length === 0) {
    p.note('No skills installed')
    p.outro('Done')
    return
  }

  const spinner = p.spinner()
  spinner.start('Checking for updates...')

  // Sync sources first
  const enabledSources = config.sources.filter((s: any) => s.enabled)
  for (const source of enabledSources) {
    await providerRegistry.sync(source)
  }

  const skills = await providerRegistry.discoverAll(enabledSources)
  let updated = 0

  for (const record of installed) {
    const skill = skills.find(s => s.id === record.id)
    if (!skill) continue

    const sourceConfig = config.sources.find((s: any) => s.name === skill._source)
    const content = await providerRegistry.fetchContent(skill, sourceConfig)

    if (content.checksum !== record.checksum) {
      spinner.message(`Updating ${record.id}...`)

      for (const targetName of record.targets) {
        const target = targetRegistry.get(targetName)
        if (!target) continue
        await target.install(content, { scope: record.scope })
      }

      record.checksum = content.checksum
      record.installedAt = new Date().toISOString()
      updated++
    }
  }

  await saveInstalled(installed)

  if (updated === 0) {
    spinner.stop('All skills are up to date')
  } else {
    spinner.stop(`Updated ${updated} skill(s)`)
  }

  p.outro('Done')
}

// ============ Source Commands ============

async function sourceList(config: any) {
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

async function sourceSync(config: any, sourceName?: string) {
  p.intro('Sync Sources')

  const spinner = p.spinner()
  spinner.start('Syncing...')

  let sourcesToSync = config.sources.filter((s: any) => s.enabled)
  if (sourceName) {
    sourcesToSync = sourcesToSync.filter((s: any) => s.name === sourceName)
    if (sourcesToSync.length === 0) {
      spinner.stop()
      p.log.error(`Source not found or disabled: ${sourceName}`)
      p.outro('Failed')
      return
    }
  }

  // Sync each source (git fetch + reset)
  for (const source of sourcesToSync) {
    spinner.message(`Syncing ${source.name}...`)
    await providerRegistry.sync(source)
  }

  // Then discover skills
  const skills = await providerRegistry.discoverAll(sourcesToSync)

  spinner.stop(`Synced ${sourcesToSync.length} source(s), found ${skills.length} skills`)
  p.outro('Done')
}

async function sourceSkills(config: any, sourceName?: string) {
  p.intro(sourceName ? `Skills in ${sourceName}` : 'Skills by Source')

  const spinner = p.spinner()
  spinner.start('Loading skills...')

  let sourcesToQuery = config.sources.filter((s: any) => s.enabled)
  if (sourceName) {
    sourcesToQuery = sourcesToQuery.filter((s: any) => s.name === sourceName)
    if (sourcesToQuery.length === 0) {
      spinner.stop()
      p.log.error(`Source not found or disabled: ${sourceName}`)
      p.outro('Failed')
      return
    }
  }

  const skills = await providerRegistry.discoverAll(sourcesToQuery)

  spinner.stop()

  // Group by source
  const bySource: Record<string, any[]> = {}
  for (const skill of skills) {
    if (!bySource[skill._source]) {
      bySource[skill._source] = []
    }
    bySource[skill._source].push(skill)
  }

  const installed = await loadInstalled()

  for (const [source, sourceSkills] of Object.entries(bySource)) {
    if (sourceName && source !== sourceName) continue

    console.log(`\n  ${source} (${sourceSkills.length})`)
    for (const skill of sourceSkills) {
      const record = installed.find(r => r.id === skill.id)
      const icon = record
        ? (record.enabled ? '✅' : '⏸️')
        : '⬜'
      console.log(`    ${icon} ${skill.id}`)
    }
  }

  console.log('')
  p.outro(`${skills.length} skill(s)`)
}

async function sourceEnable(config: any, sourceName: string) {
  const source = config.sources.find((s: any) => s.name === sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return
  }

  source.enabled = true
  await saveConfig(config)
  p.log.success(`Enabled source: ${sourceName}`)
}

async function sourceDisable(config: any, sourceName: string) {
  const source = config.sources.find((s: any) => s.name === sourceName)
  if (!source) {
    p.log.error(`Source not found: ${sourceName}`)
    return
  }

  source.enabled = false
  await saveConfig(config)
  p.log.warn(`Disabled source: ${sourceName}`)
}

async function saveConfig(config: any) {
  const configPath = join(homedir(), '.config', 'ki', 'config.yaml')
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, YAML.stringify(config, null, 2))
}

// ============ Target Commands ============

async function targetList(config: any) {
  p.intro('Targets')

  for (const targetConfig of config.targets) {
    const icon = targetConfig.enabled ? '◉' : '◯'
    const target = targetRegistry.get(targetConfig.name)

    console.log(`  ${icon} ${targetConfig.name}`)
    if (target) {
      try {
        console.log(`     Global: ${target.getGlobalPath()}`)
      } catch {
        console.log(`     Global: (not supported)`)
      }
      console.log(`     Project: ${target.getProjectPath('.')}`)
    }
    console.log('')
  }

  p.outro(`${config.targets.length} target(s)`)
}

// ============ Main ============

async function main() {
  const args = process.argv.slice(2)

  // Version flag
  if (args.includes('--version') || args.includes('-v')) {
    console.log(`skill v${VERSION}`)
    process.exit(0)
  }

  // Help flag
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    showHelp()
    process.exit(0)
  }

  // Load config
  const config = await loadConfig()
  const command = args[0]
  const flags = parseFlags(args.slice(1))

  // Route commands
  switch (command) {
    case 'init':
      await initConfig()
      break

    case 'list':
    case 'ls':
      await listSkills(config, flags)
      break

    case 'install':
      await installSkill(config, flags)
      break

    case 'uninstall':
    case 'remove':
      await uninstallSkill(flags)
      break

    case 'update':
      await updateSkills(config)
      break

    case 'source':
      const sourceCmd = flags._[0]
      if (sourceCmd === 'list' || sourceCmd === 'ls') {
        await sourceList(config)
      } else if (sourceCmd === 'sync') {
        await sourceSync(config, flags._[1])
      } else if (sourceCmd === 'skills') {
        await sourceSkills(config, flags._[1])
      } else if (sourceCmd === 'enable') {
        const sourceName = flags._[1]
        if (!sourceName) {
          console.error('Please specify a source name')
          process.exit(1)
        }
        await sourceEnable(config, sourceName)
      } else if (sourceCmd === 'disable') {
        const sourceName = flags._[1]
        if (!sourceName) {
          console.error('Please specify a source name')
          process.exit(1)
        }
        await sourceDisable(config, sourceName)
      } else {
        console.log(`
Source commands:
  ki source list             List all sources
  ki source sync [name]      Sync all sources or a specific source
  ki source skills [name]    List skills in a specific source
  ki source enable <name>    Enable a source
  ki source disable <name>   Disable a source
`)
      }
      break

    case 'target':
      const targetCmd = flags._[0]
      if (targetCmd === 'list' || targetCmd === 'ls') {
        await targetList(config)
      } else {
        console.log(`
Target commands:
  ki target list     List all targets
`)
      }
      break

    default:
      console.error(`Unknown command: ${command}`)
      showHelp()
      process.exit(1)
  }
}

main().catch(console.error)
