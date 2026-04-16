import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { getKiConfigDir, getKiInstalledFile } from './config'
import type { CliFlags, InstallOptions } from './types'

const DATA_DIR = getKiConfigDir()
const INSTALLED_FILE = getKiInstalledFile()

interface InstalledRecordBase {
  id: string
  source: string
  targets: string[]
  checksum: string
  installedAt: string
  enabled: boolean
}

export type GlobalInstalledRecord = InstalledRecordBase & {
  scope: 'global'
  projectPath?: undefined
}

export type ProjectInstalledRecord = InstalledRecordBase & {
  scope: 'project'
  projectPath: string
}

export type InstalledRecord = GlobalInstalledRecord | ProjectInstalledRecord

export function getRecordKey(
  record: Pick<InstalledRecord, 'id' | 'scope' | 'projectPath'>,
): string {
  return `${record.id}::${record.scope}::${record.projectPath ?? ''}`
}

export function formatRecordLocation(
  record: Pick<InstalledRecord, 'scope' | 'projectPath'>,
): string {
  if (record.scope === 'project') {
    return `project:${record.projectPath}`
  }

  return 'global'
}

export function formatRecordLabel(record: InstalledRecord): string {
  const location = formatRecordLocation(record)
  const targets =
    record.targets.length > 0 ? ` [${record.targets.join(', ')}]` : ''
  return `${record.id} (${location})${targets}`
}

export function findInstalledRecordIndex(
  records: InstalledRecord[],
  record: Pick<InstalledRecord, 'id' | 'scope' | 'projectPath'>,
): number {
  const key = getRecordKey(record)
  return records.findIndex((existing) => getRecordKey(existing) === key)
}

export function getInstalledRecordsForSkill(
  records: InstalledRecord[],
  skillId: string,
): InstalledRecord[] {
  return records.filter((record) => record.id === skillId)
}

export function sortInstalledRecords(
  records: InstalledRecord[],
): InstalledRecord[] {
  return [...records].sort((a, b) => {
    if (a.scope !== b.scope) {
      return a.scope === 'global' ? -1 : 1
    }

    return (a.projectPath ?? '').localeCompare(b.projectPath ?? '')
  })
}

export function getSkillSummary(records: InstalledRecord[]): string {
  const entries = records.flatMap((record) =>
    record.targets.map(
      (target) => `${target} @ ${formatRecordLocation(record)}`,
    ),
  )

  return entries.join('; ')
}

export function formatTargetsAtLocation(
  targets: string[],
  record: Pick<InstalledRecord, 'scope' | 'projectPath'>,
): string {
  return `${targets.join(', ')} @ ${formatRecordLocation(record)}`
}

export function filterInstalledRecordsByScope(
  records: InstalledRecord[],
  flags: Pick<CliFlags, 'project' | 'global'>,
  currentProjectPath: string,
): InstalledRecord[] {
  if (flags.project) {
    return records.filter(
      (record) =>
        record.scope === 'project' && record.projectPath === currentProjectPath,
    )
  }

  if (flags.global) {
    return records.filter((record) => record.scope === 'global')
  }

  return records
}

export function printInstalledRecordDetails(records: InstalledRecord[]): void {
  for (const record of sortInstalledRecords(records)) {
    const targets =
      record.targets.length > 0 ? record.targets.join(', ') : '(no targets)'
    console.log(`     ${formatRecordLocation(record)} -> ${targets}`)
  }
}

export async function loadInstalled(): Promise<InstalledRecord[]> {
  if (!existsSync(INSTALLED_FILE)) return []
  try {
    const content = await readFile(INSTALLED_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

export async function saveInstalled(records: InstalledRecord[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(INSTALLED_FILE, JSON.stringify(records, null, 2))
}

export function getRecordInstallOptions(
  record: InstalledRecord,
): InstallOptions {
  if (record.scope !== 'project') {
    return { scope: record.scope }
  }

  return {
    scope: record.scope,
    projectPath: record.projectPath,
  }
}
