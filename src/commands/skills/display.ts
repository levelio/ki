import {
  type InstalledRecord,
  getSkillSummary,
  printInstalledRecordDetails,
} from '../../installed'

export interface SkillListRow {
  installation: string
  skillId: string
  source: string
  status: string
}

export function printSkillInstallations(
  skillId: string,
  records: InstalledRecord[],
): void {
  const icon =
    records.length > 0
      ? records.some((record) => record.enabled)
        ? '✅'
        : '⏸️'
      : '⬜'
  const summary = records.length > 0 ? ` (${getSkillSummary(records)})` : ''

  console.log(`  ${icon} ${skillId}${summary}`)
  if (records.length > 0) {
    printInstalledRecordDetails(records)
  }
}

function formatListRecordScope(record: InstalledRecord): string {
  return record.scope
}

export function formatSkillListInstallation(
  records: InstalledRecord[],
): string {
  if (records.length === 0) {
    return '-'
  }

  const entries = records.flatMap((record) =>
    record.targets.map(
      (target) => `${target}@${formatListRecordScope(record)}`,
    ),
  )

  return [...new Set(entries)].join(', ')
}

function getColumnWidth(header: string, values: string[]): number {
  return Math.max(header.length, ...values.map((value) => value.length))
}

export function printSkillListTable(rows: SkillListRow[]): void {
  const headers = {
    installation: 'INSTALLATION',
    skillId: 'SKILL ID',
    source: 'SOURCE',
    status: 'STATUS',
  }

  const widths = {
    installation: getColumnWidth(
      headers.installation,
      rows.map((row) => row.installation),
    ),
    skillId: getColumnWidth(
      headers.skillId,
      rows.map((row) => row.skillId),
    ),
    source: getColumnWidth(
      headers.source,
      rows.map((row) => row.source),
    ),
    status: getColumnWidth(
      headers.status,
      rows.map((row) => row.status),
    ),
  }

  const headerLine = [
    headers.status.padEnd(widths.status),
    headers.skillId.padEnd(widths.skillId),
    headers.source.padEnd(widths.source),
    headers.installation.padEnd(widths.installation),
  ].join('  ')

  const dividerLine = [
    '-'.repeat(widths.status),
    '-'.repeat(widths.skillId),
    '-'.repeat(widths.source),
    '-'.repeat(widths.installation),
  ].join('  ')

  console.log(headerLine)
  console.log(dividerLine)

  for (const row of rows) {
    console.log(
      [
        row.status.padEnd(widths.status),
        row.skillId.padEnd(widths.skillId),
        row.source.padEnd(widths.source),
        row.installation.padEnd(widths.installation),
      ].join('  '),
    )
  }
}

export function printSourceSkillInstallations(
  skillId: string,
  records: InstalledRecord[],
): void {
  const icon =
    records.length > 0
      ? records.some((record) => record.enabled)
        ? '✅'
        : '⏸️'
      : '⬜'
  const summary = records.length > 0 ? ` (${getSkillSummary(records)})` : ''

  console.log(`    ${icon} ${skillId}${summary}`)
  if (records.length > 0) {
    printInstalledRecordDetails(records)
  }
}
