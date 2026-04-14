#!/usr/bin/env bun
import { loadConfig } from './config'
import type { CliFlags } from './types'
import {
  runDoctor,
  initConfig,
  installSkill,
  listSkills,
  searchSkills,
  showStatus,
  sourceAdd,
  sourceDisable,
  sourceEnable,
  sourceList,
  sourceRemove,
  sourceSkills,
  sourceSync,
  targetList,
  uninstallSkill,
  updateSkills,
} from './commands'

export const VERSION = '0.1.4'

type CommandModule = {
  runDoctor: typeof runDoctor
  initConfig: typeof initConfig
  installSkill: typeof installSkill
  listSkills: typeof listSkills
  searchSkills: typeof searchSkills
  showStatus: typeof showStatus
  sourceAdd: typeof sourceAdd
  sourceDisable: typeof sourceDisable
  sourceEnable: typeof sourceEnable
  sourceList: typeof sourceList
  sourceRemove: typeof sourceRemove
  sourceSkills: typeof sourceSkills
  sourceSync: typeof sourceSync
  targetList: typeof targetList
  uninstallSkill: typeof uninstallSkill
  updateSkills: typeof updateSkills
}

type CliDeps = {
  loadConfig: typeof loadConfig
  commands: CommandModule
  log: typeof console.log
  error: typeof console.error
  exit: (code: number) => void
}

export function parseFlags(args: string[]): CliFlags {
  const result: CliFlags = { _: [] }
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
      result._!.push(arg)
    }
  }
  return result
}

export function showHelp(log: typeof console.log = console.log) {
  log(`
ki v${VERSION} - Cross-tool Skill Manager

Usage:
  ki <command> [options]

Commands:
  init                  Initialize config file with defaults
  status                Show enabled sources, targets, and installs
  doctor                Check config and installed skill health
  list, ls              List all available skills
  search <query>        Search skills by name or id
  install [search]      Install skill(s) - interactive multi-select
  uninstall [search]    Uninstall skill(s) - interactive multi-select
  update                Update all installed skills
  source <cmd>          Manage sources
  target <cmd>          Manage targets

Source Commands:
  ki source add <git-url-or-path> [--name <name>]  Add a git or local source
  ki source remove <name>      Remove a source
  ki source list           List all sources
  ki source sync [name]    Sync all sources or a specific source
  ki source skills [name]  List skills in a specific source
  ki source enable <name>  Enable a source
  ki source disable <name> Disable a source

Target Commands:
  ki target list     List all targets

Options:
  --installed           Filter installed skills only
  --source <name>       Filter by source
  --global              Install or update global skills only
  --project             Install or update current project skills only
  --dry-run             Preview changes without writing
  -t, --target <list>   Comma-separated target list
  -y, --yes             Skip interactive prompts (non-interactive mode)
  --version, -v         Show version
  --help, -h            Show this help

Examples:
  ki init                        Initialize config file
  ki status                      Show current sources, targets, and installs
  ki doctor                      Check config and installed skill health
  ki list                        List all skills
  ki search brainstorming        Search skills by query
  ki list --installed            List installed skills
  ki install                     Interactive install
  ki install brainstorming --dry-run  Preview install targets and location
  ki install brainstorming       Search + install
  ki install brainstorming --project  Install to current project
  ki install superpowers:brainstorming -t claude-code -y  Direct install (non-interactive)
  ki uninstall                   Interactive multi-select
  ki uninstall superpowers:brainstorming -y  Direct uninstall (non-interactive)
  ki uninstall superpowers:brainstorming -t claude-code -y  Uninstall from specific target
  ki update                      Update all installed skills
  ki update --dry-run            Preview pending updates
  ki update --project            Update current project installs only
  ki source add https://github.com/acme/skills.git --name acme
  ki source add ./skills --name local-skills
  ki source remove skills
  ki source sync                 Sync all sources
`)
}

export async function run(args: string[], overrides: Partial<CliDeps> = {}) {
  const commands: CommandModule = overrides.commands || {
    runDoctor,
    initConfig,
    installSkill,
    listSkills,
    searchSkills,
    showStatus,
    sourceAdd,
    sourceDisable,
    sourceEnable,
    sourceList,
    sourceRemove,
    sourceSkills,
    sourceSync,
    targetList,
    uninstallSkill,
    updateSkills,
  }
  const loadConfigFn = overrides.loadConfig || loadConfig
  const log = overrides.log || console.log
  const error = overrides.error || console.error
  const exit = overrides.exit || process.exit

  // Version flag
  if (args.includes('--version') || args.includes('-v')) {
    log(`ki v${VERSION}`)
    exit(0)
    return
  }

  // Help flag
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    showHelp(log)
    exit(0)
    return
  }

  // Load config
  const config = await loadConfigFn()
  const command = args[0]
  const flags = parseFlags(args.slice(1))
  const positionals = flags._ ?? []

  // Route commands
  switch (command) {
    case 'init':
      await commands.initConfig()
      break

    case 'list':
    case 'ls':
      await commands.listSkills(config, flags)
      break

    case 'search':
      await commands.searchSkills(config, {
        ...flags,
        _: positionals.length > 0 ? positionals : flags._,
      })
      break

    case 'status':
      await commands.showStatus(config)
      break

    case 'doctor':
      await commands.runDoctor(config)
      break

    case 'install':
      await commands.installSkill(config, flags)
      break

    case 'uninstall':
    case 'remove':
      await commands.uninstallSkill(flags)
      break

    case 'update':
      await commands.updateSkills(config, flags)
      break

    case 'source':
      const sourceCmd = positionals[0]
      if (sourceCmd === 'add') {
        const sourceUrl = positionals[1]
        if (!sourceUrl) {
          error('Please specify a git source URL or local directory path')
          exit(1)
          return
        }
        const explicitName = typeof flags.name === 'string' ? flags.name : undefined
        await commands.sourceAdd(config, sourceUrl, explicitName)
      } else if (sourceCmd === 'remove') {
        const sourceName = positionals[1]
        if (!sourceName) {
          error('Please specify a source name')
          exit(1)
          return
        }
        await commands.sourceRemove(config, sourceName)
      } else if (sourceCmd === 'list' || sourceCmd === 'ls') {
        await commands.sourceList(config)
      } else if (sourceCmd === 'sync') {
        await commands.sourceSync(config, positionals[1])
      } else if (sourceCmd === 'skills') {
        await commands.sourceSkills(config, positionals[1], flags)
      } else if (sourceCmd === 'enable') {
        const sourceName = positionals[1]
        if (!sourceName) {
          error('Please specify a source name')
          exit(1)
          return
        }
        await commands.sourceEnable(config, sourceName)
      } else if (sourceCmd === 'disable') {
        const sourceName = positionals[1]
        if (!sourceName) {
          error('Please specify a source name')
          exit(1)
          return
        }
        await commands.sourceDisable(config, sourceName)
      } else {
        log(`
Source commands:
  ki source add <git-url-or-path> [--name <name>]  Add a git or local source
  ki source remove <name>       Remove a source
  ki source list             List all sources
  ki source sync [name]      Sync all sources or a specific source
  ki source skills [name]    List skills in a specific source
  ki source enable <name>    Enable a source
  ki source disable <name>   Disable a source
`)
      }
      break

    case 'target':
      const targetCmd = positionals[0]
      if (targetCmd === 'list' || targetCmd === 'ls') {
        await commands.targetList(config)
      } else {
        log(`
Target commands:
  ki target list     List all targets
`)
      }
      break

    default:
      error(`Unknown command: ${command}`)
      showHelp(log)
      exit(1)
      return
  }
}

if (import.meta.main) {
  run(process.argv.slice(2)).catch(console.error)
}
