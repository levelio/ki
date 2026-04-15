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

export function parseFlags(args: string[]): CliFlags {
  const result: CliFlags = { _: [] }

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[index + 1]
      if (next && !next.startsWith('-')) {
        result[key] = next
        index++
      } else {
        result[key] = true
      }
      continue
    }

    if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1)
      const next = args[index + 1]
      if (next && !next.startsWith('-')) {
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
  list, ls              List all available skills
  search <query>        Search skills by name or id
  install [search]      Install skill(s)
  uninstall [search]    Uninstall skill(s)
  update                Update installed skills
  source <cmd>          Manage sources
  target <cmd>          Manage targets

Source Commands:
  ki source add <git-url-or-path> [--name <name>]  Add a git or local source
  ki source remove <name>                          Remove a source
  ki source list                                   List all sources
  ki source sync [name]                            Sync all sources or a specific source
  ki source skills [name]                          List skills in a specific source
  ki source enable <name>                          Enable a source
  ki source disable <name>                         Disable a source

Target Commands:
  ki target list     List all targets

Options:
  --installed           Filter installed skills only
  --source <name>       Filter by source
  --global              Use global installs only
  --project             Use current project installs only
  --dry-run             Preview changes without writing
  -t, --target <list>   Comma-separated target list
  -y, --yes             Skip interactive prompts
  --version, -v         Show version
  --help, -h            Show this help
`)
}

function getPositionals(flags: CliFlags): string[] {
  return flags._ ?? []
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

    case 'install':
      await deps.commands.installSkill(config, flags)
      return

    case 'uninstall':
    case 'remove':
      await deps.commands.uninstallSkill(flags)
      return

    case 'update':
      await deps.commands.updateSkills(config, flags)
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

          await deps.commands.sourceAdd(config, sourceUrl, explicitName)
          return
        }

        case 'remove': {
          const sourceName = positionals[1]
          if (!sourceName) {
            deps.error('Please specify a source name')
            deps.exit(1)
            return
          }

          await deps.commands.sourceRemove(config, sourceName)
          return
        }

        case 'list':
        case 'ls':
          await deps.commands.sourceList(config)
          return

        case 'sync':
          await deps.commands.sourceSync(config, positionals[1])
          return

        case 'skills':
          await deps.commands.sourceSkills(config, positionals[1], flags)
          return

        case 'enable': {
          const sourceName = positionals[1]
          if (!sourceName) {
            deps.error('Please specify a source name')
            deps.exit(1)
            return
          }

          await deps.commands.sourceEnable(config, sourceName)
          return
        }

        case 'disable': {
          const sourceName = positionals[1]
          if (!sourceName) {
            deps.error('Please specify a source name')
            deps.exit(1)
            return
          }

          await deps.commands.sourceDisable(config, sourceName)
          return
        }

        default:
          deps.log(`
Source commands:
  ki source add <git-url-or-path> [--name <name>]  Add a git or local source
  ki source remove <name>       Remove a source
  ki source list                List all sources
  ki source sync [name]         Sync all sources or a specific source
  ki source skills [name]       List skills in a specific source
  ki source enable <name>       Enable a source
  ki source disable <name>      Disable a source
`)
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
