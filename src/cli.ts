#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
import * as commands from './commands'
import { loadConfig } from './config'
import type { CliFlags, Config } from './types'
import { formatCliVersion, readPackageVersion } from './version'

type CommandModule = typeof commands

export interface CliDeps {
  loadConfig: () => Promise<Config>
  commands: CommandModule
  log: (message: string) => void
  error: (message: string) => void
  exit: (code: number) => void
}

const defaultDeps: CliDeps = {
  loadConfig,
  commands,
  log: console.log,
  error: console.error,
  exit: process.exit,
}

export const VERSION = readPackageVersion()

const BOOLEAN_LONG_FLAGS = new Set([
  'interactive',
  'installed',
  'global',
  'project',
  'dry-run',
  'disabled',
  'enable',
  'disable',
  'version',
  'help',
])

const VALUE_LONG_FLAGS = new Set([
  'name',
  'branch',
  'skills-path',
  'structure',
  'skill-file',
  'source',
  'target',
])

const BOOLEAN_SHORT_FLAGS = new Set(['i', 'v', 'h'])
const VALUE_SHORT_FLAGS = new Set(['t'])

function shouldConsumeFlagValue(
  flag: string,
  next: string | undefined,
  isLong: boolean,
): boolean {
  if (!next || next.startsWith('-')) {
    return false
  }

  if (isLong) {
    if (BOOLEAN_LONG_FLAGS.has(flag)) return false
    if (VALUE_LONG_FLAGS.has(flag)) return true
    return true
  }

  if (BOOLEAN_SHORT_FLAGS.has(flag)) return false
  if (VALUE_SHORT_FLAGS.has(flag)) return true
  return true
}

export function parseFlags(args: string[]): CliFlags {
  const result: CliFlags = { _: [] }

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[index + 1]
      if (shouldConsumeFlagValue(key, next, true)) {
        result[key] = next
        index++
      } else {
        result[key] = true
      }
      continue
    }

    if (arg.startsWith('-') && arg.length === 2) {
      const rawKey = arg.slice(1)
      const key = rawKey === 'i' ? 'interactive' : rawKey
      const next = args[index + 1]
      if (shouldConsumeFlagValue(rawKey, next, false)) {
        result[key] = next
        index++
      } else {
        result[key] = true
      }
      continue
    }

    result._?.push(arg)
  }

  return result
}

function showHelp(log: CliDeps['log']): void {
  log(`
${formatCliVersion()} - Cross-tool Skill Manager

Usage:
  ki <command> [options]

Commands:
  init                  Initialize config file with defaults
  status                Show enabled sources, targets, and installs
  doctor                Check config and installed skill health
  reconcile             Compare installed index with target state
  repair                Repair installed index drift without touching targets
  list, ls              List all available skills
  search <query>        Search skills by name or id
  install [search]      Install an exact skill id, or use -i/--interactive
  uninstall [search]    Uninstall an exact skill id
  restore               Restore global installs from installed.json
  update                Update installed skills
  source <cmd>          Manage sources
  target <cmd>          Manage targets

Source Commands:
  ki source add <git-url-or-path> [flags]          Add a git or local source
  ki source set <name> [flags]                     Update source settings
  ki source unset <name> [flags]                   Remove source option overrides
  ki source show <name>                            Show source details
  ki source remove <name>                          Remove a source
  ki source list                                   List all sources
  ki source sync [name]                            Sync all sources or a specific source
  ki source skills [name]                          List skills in a specific source
  ki source install <name>                         Install all skills from a source
  ki source uninstall <name>                       Uninstall installed skills from a source
  ki source enable <name>                          Enable a source
  ki source disable <name>                         Disable a source

Target Commands:
  ki target list     List all targets

Options:
  --name <name>         Explicit source name
  --branch <branch>     Source branch for git providers
  --skills-path <list>  Comma-separated skill directory paths
  --structure <type>    Skill layout: nested or flat
  --skill-file <name>   Skill file name for nested sources
  --disabled            Add source in disabled state
  --enable              Enable a source while updating it
  --disable             Disable a source while updating it
  -i, --interactive     Explicitly enter TUI selection mode
  --installed           Filter installed skills only
  --source <name>       Filter by source
  --global              Use global installs only
  --project             Use current project installs only
  --dry-run             Preview changes without writing
  -t, --target <list>   Comma-separated target list
  --version, -v         Show version
  --help, -h            Show this help
`)
}

function showSourceHelp(log: CliDeps['log']): void {
  log(`
Source commands:
  ki source add <git-url-or-path> [flags]  Add a git or local source
  ki source set <name> [flags]             Update source settings
  ki source unset <name> [flags]           Remove source option overrides
  ki source show <name>                    Show source details
  ki source remove <name>                  Remove a source
  ki source list                           List all sources
  ki source sync [name]                    Sync all sources or a specific source
  ki source skills [name]                  List skills in a specific source
  ki source install <name>                 Install all skills from a source
  ki source uninstall <name>               Uninstall installed skills from a source
  ki source enable <name>                  Enable a source
  ki source disable <name>                 Disable a source

Source flags:
  --name <name>         Explicit source name for source add
  --branch <branch>     Source branch for git providers
  --skills-path <list>  Comma-separated skill directory paths
  --structure <type>    Skill layout: nested or flat
  --skill-file <name>   Skill file name for nested sources
  --disabled            Add source in disabled state
  --enable              Enable a source while updating it
  --disable             Disable a source while updating it
`)
}

function getPositionals(flags: CliFlags): string[] {
  return flags._ ?? []
}

function hasRemovedYesFlag(args: string[]): boolean {
  return args.includes('-y') || args.includes('--yes')
}

export async function run(
  args: string[],
  overrides: Partial<CliDeps> = {},
): Promise<void> {
  const deps: CliDeps = { ...defaultDeps, ...overrides }

  if (args.includes('--version') || args.includes('-v')) {
    deps.log(formatCliVersion())
    deps.exit(0)
    return
  }

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp(deps.log)
    deps.exit(0)
    return
  }

  if (hasRemovedYesFlag(args)) {
    deps.error(
      'The -y/--yes flag has been removed. Use exact non-interactive commands, or pass -i/--interactive to enter TUI install mode.',
    )
    deps.exit(1)
    return
  }

  const config = await deps.loadConfig()
  const command = args[0]
  const flags = parseFlags(args.slice(1))
  const positionals = getPositionals(flags)

  switch (command) {
    case 'init':
      await deps.commands.initConfig()
      return

    case 'list':
    case 'ls':
      await deps.commands.listSkills(config, flags)
      return

    case 'search':
      await deps.commands.searchSkills(config, flags)
      return

    case 'status':
      await deps.commands.showStatus(config)
      return

    case 'doctor':
      await deps.commands.runDoctor(config)
      return

    case 'reconcile':
      if ((await deps.commands.reconcileInstallations(config)) === false) {
        deps.exit(1)
      }
      return

    case 'repair':
      if ((await deps.commands.repairInstalledIndex(config, flags)) === false) {
        deps.exit(1)
      }
      return

    case 'install':
      if ((await deps.commands.installSkill(config, flags)) === false) {
        deps.exit(1)
      }
      return

    case 'uninstall':
    case 'remove':
      if ((await deps.commands.uninstallSkill(flags)) === false) {
        deps.exit(1)
      }
      return

    case 'update':
      await deps.commands.updateSkills(config, flags)
      return

    case 'restore':
      if ((await deps.commands.restoreInstallations(config, flags)) === false) {
        deps.exit(1)
      }
      return

    case 'source': {
      const sourceCommand = positionals[0]

      switch (sourceCommand) {
        case 'add': {
          const sourceUrl = positionals[1]
          const explicitName =
            typeof flags.name === 'string' ? flags.name : undefined

          if (!sourceUrl) {
            deps.error(
              'Please specify a git source URL or local directory path',
            )
            deps.exit(1)
            return
          }

          if (
            (await deps.commands.sourceAdd(
              config,
              sourceUrl,
              explicitName,
              flags,
            )) === false
          ) {
            deps.exit(1)
          }
          return
        }

        case 'set': {
          const sourceName = positionals[1]
          if (!sourceName) {
            deps.error('Please specify a source name')
            deps.exit(1)
            return
          }

          if (
            (await deps.commands.sourceSet(config, sourceName, flags)) === false
          ) {
            deps.exit(1)
          }
          return
        }

        case 'unset': {
          const sourceName = positionals[1]
          if (!sourceName) {
            deps.error('Please specify a source name')
            deps.exit(1)
            return
          }

          if (
            (await deps.commands.sourceUnset(config, sourceName, flags)) ===
            false
          ) {
            deps.exit(1)
          }
          return
        }

        case 'show': {
          const sourceName = positionals[1]
          if (!sourceName) {
            deps.error('Please specify a source name')
            deps.exit(1)
            return
          }

          if ((await deps.commands.sourceShow(config, sourceName)) === false) {
            deps.exit(1)
          }
          return
        }

        case 'remove': {
          const sourceName = positionals[1]
          if (!sourceName) {
            deps.error('Please specify a source name')
            deps.exit(1)
            return
          }

          if (
            (await deps.commands.sourceRemove(config, sourceName)) === false
          ) {
            deps.exit(1)
          }
          return
        }

        case 'list':
        case 'ls':
          if ((await deps.commands.sourceList(config)) === false) {
            deps.exit(1)
          }
          return

        case 'sync':
          if (
            (await deps.commands.sourceSync(config, positionals[1])) === false
          ) {
            deps.exit(1)
          }
          return

        case 'skills':
          if (
            (await deps.commands.sourceSkills(
              config,
              positionals[1],
              flags,
            )) === false
          ) {
            deps.exit(1)
          }
          return

        case 'install': {
          const sourceName = positionals[1]
          if (!sourceName) {
            deps.error('Please specify a source name')
            deps.exit(1)
            return
          }

          if (
            (await deps.commands.sourceInstall(config, sourceName, flags)) ===
            false
          ) {
            deps.exit(1)
          }
          return
        }

        case 'uninstall': {
          const sourceName = positionals[1]
          if (!sourceName) {
            deps.error('Please specify a source name')
            deps.exit(1)
            return
          }

          if (
            (await deps.commands.sourceUninstall(config, sourceName, flags)) ===
            false
          ) {
            deps.exit(1)
          }
          return
        }

        case 'enable': {
          const sourceName = positionals[1]
          if (!sourceName) {
            deps.error('Please specify a source name')
            deps.exit(1)
            return
          }

          if (
            (await deps.commands.sourceEnable(config, sourceName)) === false
          ) {
            deps.exit(1)
          }
          return
        }

        case 'disable': {
          const sourceName = positionals[1]
          if (!sourceName) {
            deps.error('Please specify a source name')
            deps.exit(1)
            return
          }

          if (
            (await deps.commands.sourceDisable(config, sourceName)) === false
          ) {
            deps.exit(1)
          }
          return
        }

        default:
          showSourceHelp(deps.log)
          return
      }
    }

    case 'target': {
      const targetCommand = positionals[0]

      if (targetCommand === 'list' || targetCommand === 'ls') {
        await deps.commands.targetList(config)
        return
      }

      deps.log(`
Target commands:
  ki target list     List all targets
`)
      return
    }

    default:
      deps.error(`Unknown command: ${command}`)
      showHelp(deps.log)
      deps.exit(1)
  }
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
