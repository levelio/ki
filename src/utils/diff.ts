// src/utils/diff.ts

export interface DiffLine {
  type: 'add' | 'remove' | 'context'
  content: string
}

export function computeDiff(
  oldContent: string,
  newContent: string,
): DiffLine[] {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const result: DiffLine[] = []

  // Simple line-by-line diff
  const maxLen = Math.max(oldLines.length, newLines.length)

  let oldIdx = 0
  let newIdx = 0

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx >= oldLines.length) {
      // Remaining new lines are additions
      result.push({ type: 'add', content: newLines[newIdx] })
      newIdx++
    } else if (newIdx >= newLines.length) {
      // Remaining old lines are removals
      result.push({ type: 'remove', content: oldLines[oldIdx] })
      oldIdx++
    } else if (oldLines[oldIdx] === newLines[newIdx]) {
      // Same line
      result.push({ type: 'context', content: oldLines[oldIdx] })
      oldIdx++
      newIdx++
    } else {
      // Check if line was removed
      const newLineIdx = newLines.indexOf(oldLines[oldIdx], newIdx)
      const oldLineIdx = oldLines.indexOf(newLines[newIdx], oldIdx)

      if (newLineIdx === -1 || (oldLineIdx !== -1 && oldLineIdx < newLineIdx)) {
        // Line was removed
        result.push({ type: 'remove', content: oldLines[oldIdx] })
        oldIdx++
      } else {
        // Line was added
        result.push({ type: 'add', content: newLines[newIdx] })
        newIdx++
      }
    }
  }

  return result
}

export function formatDiff(diff: DiffLine[]): string {
  return diff
    .map((line) => {
      const prefix =
        line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '
      return `${prefix} ${line.content}`
    })
    .join('\n')
}
