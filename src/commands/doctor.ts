import { existsSync } from 'node:fs'
import * as p from '@clack/prompts'
import { type InstalledRecord, loadInstalled } from '../installed'
import { targetRegistry } from '../targets'
import type { Config } from '../types'

interface DoctorIssue {
  level: 'warn' | 'error'
  message: string
  fix?: string
}

interface DoctorDeps {
  cwd: () => string
  loadInstalled: typeof loadInstalled
  pathExists: typeof existsSync
  targetRegistry: Pick<typeof targetRegistry, 'get'>
}

const defaultDoctorDeps: DoctorDeps = {
  cwd: () => process.cwd(),
  loadInstalled,
  pathExists: existsSync,
  targetRegistry,
}

function addIssue(
  issues: DoctorIssue[],
  level: DoctorIssue['level'],
  message: string,
  fix?: string,
) {
  issues.push({ level, message, fix })
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) {
    return value
  }

  return `'${value.replace(/'/g, `'\\''`)}'`
}

function formatCommand(args: string[]): string {
  return args.map(quoteShellArg).join(' ')
}

function formatScopedCommand(record: InstalledRecord, args: string[]): string {
  const scopedArgs = [
    ...args,
    record.scope === 'project' ? '--project' : '--global',
  ]

  if (record.scope === 'project' && record.projectPath !== process.cwd()) {
    return `cd ${quoteShellArg(record.projectPath)} && ${formatCommand(scopedArgs)}`
  }

  return formatCommand(scopedArgs)
}

function buildUninstallFix(
  record: InstalledRecord,
  targetName?: string,
): string {
  const args = ['ki', 'uninstall', record.id]
  const targetNames = targetName ? [targetName] : record.targets
  if (targetNames.length > 0) {
    args.push('-t', targetNames.join(','))
  }

  return formatScopedCommand(record, args)
}

function buildInstallFix(record: InstalledRecord, targetName: string): string {
  return formatScopedCommand(record, [
    'ki',
    'install',
    record.id,
    '-t',
    targetName,
  ])
}

function getNoEnabledSourcesFix(config: Pick<Config, 'sources'>): string {
  if (config.sources.length === 0) {
    return 'ki source add <git-url-or-path> --name <source-name>'
  }

  return `ki source enable ${quoteShellArg(config.sources[0].name)}`
}

function checkRecordTargetPath(
  record: InstalledRecord,
  targetName: string,
  deps: Pick<DoctorDeps, 'pathExists' | 'targetRegistry'>,
): string | null {
  const target = deps.targetRegistry.get(targetName)
  if (!target) {
    return null
  }

  let path: string
  try {
    path =
      record.scope === 'project'
        ? target.getProjectPath(record.projectPath)
        : target.getGlobalPath()
  } catch {
    return null
  }

  return deps.pathExists(path) ? null : path
}

function collectIssues(
  config: Pick<Config, 'sources' | 'targets'>,
  records: InstalledRecord[],
  deps: Pick<DoctorDeps, 'pathExists' | 'targetRegistry'>,
): DoctorIssue[] {
  const issues: DoctorIssue[] = []

  if (config.sources.length === 0) {
    addIssue(
      issues,
      'warn',
      'No sources configured',
      'ki source add <git-url-or-path> --name <source-name>',
    )
  }
  if (!config.sources.some((source) => source.enabled)) {
    addIssue(
      issues,
      'warn',
      'No enabled sources',
      getNoEnabledSourcesFix(config),
    )
  }
  if (config.targets.length === 0) {
    addIssue(
      issues,
      'warn',
      'No targets configured',
      'Run ki target list, then add at least one enabled target in your ki config',
    )
  }
  if (!config.targets.some((target) => target.enabled)) {
    addIssue(
      issues,
      'warn',
      'No enabled targets',
      'Enable at least one target in your ki config, then run ki doctor again',
    )
  }

  for (const targetConfig of config.targets) {
    if (!deps.targetRegistry.get(targetConfig.name)) {
      addIssue(
        issues,
        'error',
        `Configured target is not supported: ${targetConfig.name}`,
        `Run ki target list, then remove or rename ${quoteShellArg(targetConfig.name)} in your ki config`,
      )
    }
  }

  for (const record of records) {
    if (!config.sources.some((source) => source.name === record.source)) {
      addIssue(
        issues,
        'error',
        `Installed record references missing source: ${record.id} -> ${record.source}`,
        buildUninstallFix(record),
      )
    }

    for (const targetName of record.targets) {
      if (!config.targets.some((target) => target.name === targetName)) {
        addIssue(
          issues,
          'error',
          `Installed record references missing target config: ${record.id} -> ${targetName}`,
          buildUninstallFix(record, targetName),
        )
        continue
      }

      if (!deps.targetRegistry.get(targetName)) {
        addIssue(
          issues,
          'error',
          `Installed record references unsupported target: ${record.id} -> ${targetName}`,
          buildUninstallFix(record, targetName),
        )
        continue
      }

      const missingPath = checkRecordTargetPath(record, targetName, deps)
      if (missingPath) {
        const source = config.sources.find(
          (existing) => existing.name === record.source,
        )
        addIssue(
          issues,
          'warn',
          `Expected target path does not exist for ${record.id} -> ${targetName}: ${missingPath}`,
          source?.enabled
            ? buildInstallFix(record, targetName)
            : buildUninstallFix(record, targetName),
        )
      }
    }
  }

  return issues
}

export async function runDoctor(
  config: Pick<Config, 'sources' | 'targets'>,
  overrides: Partial<DoctorDeps> = {},
) {
  const deps = { ...defaultDoctorDeps, ...overrides }

  p.intro('Doctor')

  const records = await deps.loadInstalled()
  const currentProjectPath = deps.cwd()
  const enabledSources = config.sources.filter((source) => source.enabled)
  const enabledTargets = config.targets.filter((target) => target.enabled)
  const currentProjectRecords = records.filter(
    (record) =>
      record.scope === 'project' && record.projectPath === currentProjectPath,
  )
  const issues = collectIssues(config, records, deps)

  console.log('\nSummary')
  console.log(
    `  Sources: ${enabledSources.length}/${config.sources.length} enabled`,
  )
  console.log(
    `  Targets: ${enabledTargets.length}/${config.targets.length} enabled`,
  )
  console.log(`  Installed records: ${records.length}`)
  console.log(`  Current project records: ${currentProjectRecords.length}`)

  console.log('\nChecks')
  if (issues.length === 0) {
    console.log('  ✅ No issues found')
    p.outro('Done')
    return
  }

  for (const issue of issues) {
    const icon = issue.level === 'error' ? '❌' : '⚠️'
    console.log(`  ${icon} ${issue.message}`)
    if (issue.fix) {
      console.log(`     Fix: ${issue.fix}`)
    }
  }

  p.outro(`Found ${issues.length} issue(s)`)
}
