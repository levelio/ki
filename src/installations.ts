import type { InstalledRecord } from './installed'
import { targetRegistry } from './targets'
import type { InstallOptions, Target, TargetConfig } from './types'

interface ScanLocation {
  projectPath?: string
  scope: 'global' | 'project'
  targetName: string
}

export interface UntrackedTargetInstallation extends ScanLocation {
  skillId: string
}

export interface TargetScanError extends ScanLocation {
  message: string
}

export interface MissingRecordedTargetInstallation {
  record: InstalledRecord
  targetName: string
}

export interface InstallationDriftReport {
  missingRecordedTargets: MissingRecordedTargetInstallation[]
  scanErrors: TargetScanError[]
  untrackedTargetInstallations: UntrackedTargetInstallation[]
}

interface InstallationDeps {
  targetRegistry: Pick<typeof targetRegistry, 'get'>
}

const defaultDeps: InstallationDeps = {
  targetRegistry,
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getLocationKey(location: ScanLocation): string {
  return `${location.targetName}::${location.scope}::${location.projectPath ?? ''}`
}

function isDuplicateProjectLocation(
  target: Pick<Target, 'getGlobalPath' | 'getProjectPath'>,
  projectPath: string,
): boolean {
  return target.getProjectPath(projectPath) === target.getGlobalPath()
}

function getRecordLocation(
  record: InstalledRecord,
  targetName: string,
): ScanLocation {
  if (record.scope === 'project') {
    return {
      targetName,
      scope: 'project',
      projectPath: record.projectPath,
    }
  }

  return {
    targetName,
    scope: 'global',
  }
}

function getFallbackInstalledId(skillId: string): string {
  const parts = skillId.split(':')
  return parts[parts.length - 1] ?? skillId
}

export function resolveInstalledId(target: Target, skillId: string): string {
  if (typeof target.resolveInstalledId === 'function') {
    return target.resolveInstalledId(skillId)
  }

  return getFallbackInstalledId(skillId)
}

export async function isSkillInstalledInTarget(
  target: Target,
  skillId: string,
  options: InstallOptions,
): Promise<boolean> {
  if (typeof target.isInstalled === 'function') {
    return target.isInstalled(skillId, options)
  }

  const installed = await target.list(
    options.scope,
    options.scope === 'project' ? options.projectPath : undefined,
  )
  const expectedId = resolveInstalledId(target, skillId)

  return installed.some(
    (entry) => entry.id === expectedId || entry.id === skillId,
  )
}

async function scanLocation(
  location: ScanLocation,
  deps: InstallationDeps,
): Promise<
  | { ids: Set<string>; location: ScanLocation; target: Target }
  | { error: TargetScanError }
> {
  const target = deps.targetRegistry.get(location.targetName)
  if (!target) {
    return {
      error: {
        ...location,
        message: 'target is not registered',
      },
    }
  }

  try {
    const installed = await target.list(
      location.scope,
      location.scope === 'project' ? location.projectPath : undefined,
    )

    return {
      target,
      location,
      ids: new Set(installed.map((entry) => entry.id)),
    }
  } catch (error) {
    return {
      error: {
        ...location,
        message: getErrorMessage(error),
      },
    }
  }
}

export async function collectInstallationDrift(
  records: InstalledRecord[],
  targetConfigs: TargetConfig[],
  currentProjectPath: string,
  overrides: Partial<InstallationDeps> = {},
): Promise<InstallationDriftReport> {
  const deps = { ...defaultDeps, ...overrides }
  const locations = new Map<string, ScanLocation>()

  for (const targetConfig of targetConfigs) {
    const target = deps.targetRegistry.get(targetConfig.name)
    if (!target) {
      continue
    }

    const globalLocation: ScanLocation = {
      targetName: targetConfig.name,
      scope: 'global',
    }
    locations.set(getLocationKey(globalLocation), globalLocation)

    if (!isDuplicateProjectLocation(target, currentProjectPath)) {
      const currentProjectLocation: ScanLocation = {
        targetName: targetConfig.name,
        scope: 'project',
        projectPath: currentProjectPath,
      }
      locations.set(
        getLocationKey(currentProjectLocation),
        currentProjectLocation,
      )
    }
  }

  for (const record of records) {
    for (const targetName of record.targets) {
      if (!deps.targetRegistry.get(targetName)) {
        continue
      }

      const location = getRecordLocation(record, targetName)
      locations.set(getLocationKey(location), location)
    }
  }

  const scannedByLocation = new Map<
    string,
    { ids: Set<string>; location: ScanLocation; target: Target }
  >()
  const scanErrors: TargetScanError[] = []

  for (const location of locations.values()) {
    const result = await scanLocation(location, deps)
    if ('error' in result) {
      scanErrors.push(result.error)
      continue
    }

    scannedByLocation.set(getLocationKey(location), result)
  }

  const missingRecordedTargets: MissingRecordedTargetInstallation[] = []
  for (const record of records) {
    for (const targetName of record.targets) {
      const location = getRecordLocation(record, targetName)
      const scanned = scannedByLocation.get(getLocationKey(location))
      if (!scanned) {
        continue
      }

      const expectedId = resolveInstalledId(scanned.target, record.id)
      if (!scanned.ids.has(expectedId)) {
        missingRecordedTargets.push({ record, targetName })
      }
    }
  }

  const untrackedTargetInstallations: UntrackedTargetInstallation[] = []
  for (const { ids, location, target } of scannedByLocation.values()) {
    const trackedIds = new Set(
      records
        .filter((record) => {
          if (!record.targets.includes(location.targetName)) {
            return false
          }

          if (location.scope !== record.scope) {
            return false
          }

          if (location.scope === 'project') {
            return record.projectPath === location.projectPath
          }

          return true
        })
        .map((record) => resolveInstalledId(target, record.id)),
    )

    for (const id of ids) {
      if (!trackedIds.has(id)) {
        untrackedTargetInstallations.push({
          ...location,
          skillId: id,
        })
      }
    }
  }

  return {
    missingRecordedTargets,
    scanErrors,
    untrackedTargetInstallations,
  }
}

export function formatScannedLocation(
  location: Pick<ScanLocation, 'scope' | 'projectPath'>,
): string {
  if (location.scope === 'project') {
    return `project:${location.projectPath}`
  }

  return 'global'
}

export function formatTargetInstallation(
  location: Pick<ScanLocation, 'targetName' | 'scope' | 'projectPath'>,
  skillId: string,
): string {
  return `${location.targetName} -> ${skillId} @ ${formatScannedLocation(location)}`
}

export function getTargetPath(
  target: Pick<Target, 'getGlobalPath' | 'getProjectPath'>,
  location: Pick<ScanLocation, 'scope' | 'projectPath'>,
): string {
  if (location.scope === 'project' && location.projectPath) {
    return target.getProjectPath(location.projectPath)
  }

  return target.getGlobalPath()
}
