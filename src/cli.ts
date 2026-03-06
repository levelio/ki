#!/usr/bin/env bun
import * as p from '@clack/prompts'
import { loadConfig } from './config'
import { providerRegistry } from './providers'
import { targetRegistry } from './targets'
import { existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { computeFileChecksum } from './utils'

const VERSION = '0.1.0'

// Data paths
const DATA_DIR = join(homedir(), '.config', 'lazyskill')
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
skill v${VERSION} - LazySkill CLI

Usage:
  skill <command> [options]

Commands:
  list, ls              List all available skills
  install <id>          Install a skill
  uninstall <id>        Uninstall a skill
  enable <id>           Enable a skill
  disable <id>          Disable a skill
  update [id]           Update skill(s)
  source <cmd>          Manage sources
  target <cmd>          Manage targets

Source Commands:
  skill source list     List all sources
  skill source sync     Sync all sources

Target Commands:
  skill target list     List all targets

Options:
  --installed           Filter installed skills only
  --source <name>       Filter by source
  --global              Install to global scope (default)
  --project             Install to project scope
  -t, --target <list>   Comma-separated target list
  --all                 Update all skills
  --version, -v         Show version
  --help, -h            Show this help

Examples:
  skill list
  skill list --installed
  skill install superpowers:brainstorming
  skill install superpowers:brainstorming -t claude-code,cursor
  skill install superpowers:brainstorming --project
  skill uninstall superpowers:brainstorming
  skill update --all
  skill source sync
`)
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
    if (skill.description) {
      console.log(`     ${skill.description.slice(0, 60)}${skill.description.length > 60 ? '...' : ''}`)
    }
  }
  console.log('')
  p.outro(`${filtered.length} skill(s)`)
}

// ============ Install Command ============

async function installSkill(config: any, flags: Record<string, any>) {
  let skillId = flags._[0]

  p.intro(skillId ? `Install ${skillId}` : 'Install Skill')

  // Load skills
  const enabledSources = config.sources.filter((s: any) => s.enabled)
  const skills = await providerRegistry.discoverAll(enabledSources)

  if (skills.length === 0) {
    p.note('No skills available. Add sources first.')
    p.outro('Done')
    return
  }

  // Interactive selection if no skillId
  if (!skillId) {
    const selected = await p.select({
      message: 'Select a skill to install',
      options: skills.map(s => ({
        value: s.id,
        label: s.name,
        hint: s._source
      }))
    })

    if (p.isCancel(selected)) {
      p.outro('Cancelled')
      return
    }
    skillId = selected as string
  }

  // Find skill
  const skill = skills.find(s => s.id === skillId)
  if (!skill) {
    p.log.error(`Skill not found: ${skillId}`)
    p.outro('Failed')
    return
  }

  // Get skill content
  const sourceConfig = config.sources.find((s: any) => s.name === skill._source)
  const content = await providerRegistry.fetchContent(skill, sourceConfig)

  // Determine targets
  let targets: string[]
  if (flags['t'] || flags['target']) {
    targets = (flags['t'] || flags['target']).split(',').map((t: string) => t.trim())
  } else {
    const enabledTargets = config.targets.filter((t: any) => t.enabled)
    const selected = await p.multiselect({
      message: 'Select targets',
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

  // Install
  const spinner = p.spinner()
  spinner.start('Installing...')

  const installed = await loadInstalled()

  for (const targetName of targets) {
    const target = targetRegistry.get(targetName)
    if (!target) {
      spinner.stop()
      p.log.warn(`Target not found: ${targetName}`)
      continue
    }

    try {
      await target.install(content, { scope })
      spinner.message(`Installed to ${targetName}`)
    } catch (error: any) {
      spinner.stop()
      p.log.error(`Failed to install to ${targetName}: ${error.message}`)
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

  await saveInstalled(installed)

  spinner.stop('Done')
  p.outro(`Installed ${skillId} to ${targets.length} target(s)`)
}

// ============ Uninstall Command ============

async function uninstallSkill(flags: Record<string, any>) {
  let skillId = flags._[0]

  p.intro(skillId ? `Uninstall ${skillId}` : 'Uninstall Skill')

  const installed = await loadInstalled()

  if (installed.length === 0) {
    p.note('No skills installed')
    p.outro('Done')
    return
  }

  // Interactive selection if no skillId
  if (!skillId) {
    const selected = await p.select({
      message: 'Select a skill to uninstall',
      options: installed.map(r => ({
        value: r.id,
        label: r.id,
        hint: r.targets.join(', ')
      }))
    })

    if (p.isCancel(selected)) {
      p.outro('Cancelled')
      return
    }
    skillId = selected as string
  }

  const record = installed.find(r => r.id === skillId)
  if (!record) {
    p.log.error(`Skill not installed: ${skillId}`)
    p.outro('Failed')
    return
  }

  const spinner = p.spinner()
  spinner.start('Uninstalling...')

  for (const targetName of record.targets) {
    const target = targetRegistry.get(targetName)
    if (!target) continue

    try {
      await target.uninstall(skillId, { scope: record.scope })
      spinner.message(`Removed from ${targetName}`)
    } catch {
      p.log.warn(`Failed to remove from ${targetName}`)
    }
  }

  // Remove from installed records
  const newInstalled = installed.filter(r => r.id !== skillId)
  await saveInstalled(newInstalled)

  spinner.stop('Done')
  p.outro(`Uninstalled ${skillId}`)
}

// ============ Enable/Disable Commands ============

async function enableSkill(skillId: string) {
  const installed = await loadInstalled()
  const record = installed.find(r => r.id === skillId)

  if (!record) {
    console.error(`Skill not installed: ${skillId}`)
    return
  }

  record.enabled = true
  await saveInstalled(installed)
  console.log(`✅ Enabled ${skillId}`)
}

async function disableSkill(skillId: string) {
  const installed = await loadInstalled()
  const record = installed.find(r => r.id === skillId)

  if (!record) {
    console.error(`Skill not installed: ${skillId}`)
    return
  }

  record.enabled = false
  await saveInstalled(installed)
  console.log(`⏸️ Disabled ${skillId}`)
}

// ============ Update Command ============

async function updateSkill(config: any, flags: Record<string, any>) {
  const skillId = flags._[0]

  p.intro('Update Skills')

  const installed = await loadInstalled()
  const enabledSources = config.sources.filter((s: any) => s.enabled)

  if (flags['all'] || !skillId) {
    // Update all
    const spinner = p.spinner()
    spinner.start('Checking for updates...')

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
  } else {
    // Update specific skill
    const record = installed.find(r => r.id === skillId)
    if (!record) {
      p.log.error(`Skill not installed: ${skillId}`)
      p.outro('Failed')
      return
    }

    const spinner = p.spinner()
    spinner.start(`Updating ${skillId}...`)

    const skills = await providerRegistry.discoverAll(enabledSources)
    const skill = skills.find(s => s.id === skillId)

    if (!skill) {
      spinner.stop()
      p.log.error(`Skill not found: ${skillId}`)
      p.outro('Failed')
      return
    }

    const sourceConfig = config.sources.find((s: any) => s.name === skill._source)
    const content = await providerRegistry.fetchContent(skill, sourceConfig)

    if (content.checksum === record.checksum) {
      spinner.stop('Already up to date')
    } else {
      for (const targetName of record.targets) {
        const target = targetRegistry.get(targetName)
        if (!target) continue
        await target.install(content, { scope: record.scope })
      }

      record.checksum = content.checksum
      record.installedAt = new Date().toISOString()
      await saveInstalled(installed)

      spinner.stop('Updated')
    }
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

async function sourceSync(config: any) {
  p.intro('Sync Sources')

  const spinner = p.spinner()
  spinner.start('Syncing...')

  const enabledSources = config.sources.filter((s: any) => s.enabled)
  const skills = await providerRegistry.discoverAll(enabledSources)

  spinner.stop(`Synced ${enabledSources.length} source(s), found ${skills.length} skills`)
  p.outro('Done')
}

// ============ Target Commands ============

async function targetList(config: any) {
  p.intro('Targets')

  for (const targetConfig of config.targets) {
    const icon = targetConfig.enabled ? '◉' : '◯'
    const target = targetRegistry.get(targetConfig.name)

    console.log(`  ${icon} ${targetConfig.name}`)
    if (target) {
      console.log(`     Global: ${target.getGlobalPath()}`)
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

    case 'enable':
      if (!flags._[0]) {
        console.error('Please specify a skill ID')
        process.exit(1)
      }
      await enableSkill(flags._[0])
      break

    case 'disable':
      if (!flags._[0]) {
        console.error('Please specify a skill ID')
        process.exit(1)
      }
      await disableSkill(flags._[0])
      break

    case 'update':
      await updateSkill(config, flags)
      break

    case 'source':
      const sourceCmd = flags._[0]
      if (sourceCmd === 'list' || sourceCmd === 'ls') {
        await sourceList(config)
      } else if (sourceCmd === 'sync') {
        await sourceSync(config)
      } else {
        console.log(`
Source commands:
  skill source list     List all sources
  skill source sync     Sync all sources
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
  skill target list     List all targets
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
