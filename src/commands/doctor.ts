import {
  collectInstallationDrift,
  formatScannedLocation,
  getTargetPath,
} from '../installations'
import { type InstalledRecord, loadInstalled } from '../installed'
import { targetRegistry } from '../targets'
import type { Config } from '../types'
import * as p from '../ui'

interface DoctorIssue {
  level: 'warn' | 'error'
  message: string
  fix?: string
}

interface DoctorDeps {
  cwd: () => string
  loadInstalled: typeof loadInstalled
  targetRegistry: Pick<typeof targetRegistry, 'get'>
}

const defaultDoctorDeps: DoctorDeps = {
  cwd: () => process.cwd(),
  loadInstalled,
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

async function collectIssues(
  config: Pick<Config, 'sources' | 'targets'>,
  records: InstalledRecord[],
  currentProjectPath: string,
  deps: Pick<DoctorDeps, 'targetRegistry'>,
): Promise<DoctorIssue[]> {
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
      }
    }
  }

  const drift = await collectInstallationDrift(
    records,
    config.targets,
    currentProjectPath,
    deps,
  )

  for (const missing of drift.missingRecordedTargets) {
    const source = config.sources.find(
      (existing) => existing.name === missing.record.source,
    )
    addIssue(
      issues,
      'warn',
      `Installed record is missing from target: ${missing.record.id} -> ${missing.targetName} @ ${formatScannedLocation(missing.record)}`,
      source?.enabled
        ? buildInstallFix(missing.record, missing.targetName)
        : buildUninstallFix(missing.record, missing.targetName),
    )
  }

  for (const untracked of drift.untrackedTargetInstallations) {
    const target = deps.targetRegistry.get(untracked.targetName)
    const targetPath = target ? getTargetPath(target, untracked) : null
    addIssue(
      issues,
      'warn',
      `Untracked target installation detected: ${untracked.targetName} -> ${untracked.skillId} @ ${formatScannedLocation(untracked)}`,
      targetPath
        ? `Inspect ${quoteShellArg(targetPath)} and either reinstall this skill via ki or remove the orphaned target artifact`
        : undefined,
    )
  }

  for (const scanError of drift.scanErrors) {
    addIssue(
      issues,
      'warn',
      `Failed to scan target ${scanError.targetName} @ ${formatScannedLocation(scanError)}: ${scanError.message}`,
    )
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
  const issues = await collectIssues(config, records, currentProjectPath, deps)

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
