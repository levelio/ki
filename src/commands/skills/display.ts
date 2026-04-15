import {
  type InstalledRecord,
  getSkillSummary,
  printInstalledRecordDetails,
} from '../../installed'

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
