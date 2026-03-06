// src/tui/components/panel.ts
import type { SkillMeta, SourceConfig, TargetConfig } from '../../types'
import { computeDiff, type DiffLine } from '../../utils/diff'

// ANSI escape codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  red: '\x1b[31m',
  inverse: '\x1b[7m',
  bgBlue: '\x1b[44m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
}

export interface PanelOptions {
  title: string
  items: string[]
  selected: number
  width: number
  height: number
  active: boolean
  // Visual mode support
  visualMode?: boolean
  visualStart?: number
  visualEnd?: number
  // Update indicators
  updateIndicators?: boolean[]
}

/**
 * Render a panel with title and items
 */
export function renderPanel(options: PanelOptions): string[] {
  const { title, items, selected, width, height, active, visualMode, visualStart = 0, visualEnd = 0, updateIndicators = [] } = options
  const lines: string[] = []

  // Panel border color
  const borderColor = active ? ANSI.cyan : ANSI.dim
  const titleColor = active ? ANSI.bold + ANSI.cyan : ANSI.dim

  // Title line
  const titleText = ` ${title} `
  const titleDashes = '─'.repeat(Math.max(0, width - titleText.length - 2))
  lines.push(`${borderColor}┌${titleColor}${titleText}${borderColor}${titleDashes}┐${ANSI.reset}`)

  // Content lines
  const contentHeight = Math.max(1, height - 2) // Reserve 2 lines for top/bottom border

  // Calculate visual selection range
  const visualMin = Math.min(visualStart, visualEnd)
  const visualMax = Math.max(visualStart, visualEnd)

  for (let i = 0; i < contentHeight; i++) {
    const item = items[i]
    if (item !== undefined) {
      const isCurrentSelected = i === selected
      const isInVisualRange = visualMode && i >= visualMin && i <= visualMax
      const hasUpdate = updateIndicators[i]
      let displayItem = item

      // Add update indicator if skill has update
      if (hasUpdate) {
        displayItem = displayItem + ' ' + ANSI.yellow + '(update)' + ANSI.reset
      }

      // Determine prefix based on selection state
      let prefix = '  '
      if (isInVisualRange) {
        prefix = '■ ' // Selected in visual mode
      } else if (isCurrentSelected) {
        prefix = '▶ '
      }

      // Truncate if too long
      const maxLen = width - 4 // Border chars + prefix
      const plainItem = displayItem.replace(/\x1b\[[0-9;]*m/g, '')
      if (plainItem.length > maxLen) {
        // Need to truncate carefully with ANSI codes
        displayItem = truncate(displayItem, maxLen)
      }

      // Pad to fill width
      const paddedItem = (prefix + displayItem).padEnd(width - 2)
      const content = paddedItem.slice(0, width - 2)

      if (isInVisualRange && active) {
        // Visual selection highlight with magenta
        lines.push(`${borderColor}│${ANSI.inverse}${content}${ANSI.reset}${borderColor}│${ANSI.reset}`)
      } else if (isCurrentSelected && active) {
        lines.push(`${borderColor}│${ANSI.inverse}${content}${ANSI.reset}${borderColor}│${ANSI.reset}`)
      } else if (isCurrentSelected) {
        lines.push(`${borderColor}│${ANSI.dim}${content}${ANSI.reset}${borderColor}│${ANSI.reset}`)
      } else {
        lines.push(`${borderColor}│${content}${borderColor}│${ANSI.reset}`)
      }
    } else {
      // Empty line
      lines.push(`${borderColor}│${' '.repeat(width - 2)}│${ANSI.reset}`)
    }
  }

  // Bottom border
  lines.push(`${borderColor}└${'─'.repeat(width - 2)}┘${ANSI.reset}`)

  return lines
}

export interface DetailPanelOptions {
  title: string
  item: SkillMeta | SourceConfig | TargetConfig | null
  type: 'skills' | 'sources' | 'targets'
  width: number
  height: number
}

/**
 * Render the detail panel showing item information
 */
export function renderDetailPanel(options: DetailPanelOptions): string[] {
  const { title, item, type, width, height } = options
  const lines: string[] = []

  // Title line
  const titleText = ` ${title} `
  const titleDashes = '─'.repeat(Math.max(0, width - titleText.length - 2))
  lines.push(`${ANSI.cyan}┌${ANSI.bold}${titleText}${ANSI.reset}${ANSI.cyan}${titleDashes}┐${ANSI.reset}`)

  if (!item) {
    // No item selected
    const emptyLines = height - 2
    for (let i = 0; i < emptyLines; i++) {
      lines.push(`${ANSI.cyan}│${ANSI.dim}${' No item selected '.padEnd(width - 2)}${ANSI.reset}${ANSI.cyan}│${ANSI.reset}`)
    }
  } else if (type === 'skills') {
    // Skill details
    const skill = item as SkillMeta
    lines.push(...renderSkillDetail(skill, width, height - 2))
  } else if (type === 'sources') {
    // Source details
    const source = item as SourceConfig
    lines.push(...renderSourceDetail(source, width, height - 2))
  } else if (type === 'targets') {
    // Target details
    const target = item as TargetConfig
    lines.push(...renderTargetDetail(target, width, height - 2))
  }

  // Bottom border
  lines.push(`${ANSI.cyan}└${'─'.repeat(width - 2)}┘${ANSI.reset}`)

  // Pad to height
  while (lines.length < height) {
    lines.splice(lines.length - 1, 0, `${ANSI.cyan}│${' '.repeat(width - 2)}│${ANSI.reset}`)
  }

  return lines
}

/**
 * Render skill detail content
 */
function renderSkillDetail(skill: SkillMeta, width: number, maxHeight: number): string[] {
  const lines: string[] = []
  const contentWidth = width - 4 // Account for border and padding

  // Name with update indicator if applicable
  const updateIndicator = skill._hasUpdate ? ` ${ANSI.yellow}(update)${ANSI.reset}` : ''
  lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.bold}${ANSI.green}${truncate(skill.name, contentWidth)}${ANSI.reset}${updateIndicator}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)

  // ID
  lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}ID: ${ANSI.reset}${truncate(skill.id, contentWidth - 5)}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)

  // Separator
  lines.push(`${ANSI.cyan}│${'─'.repeat(width - 2)}│${ANSI.reset}`)

  // If skill has update, show diff instead of normal details
  if (skill._hasUpdate && skill._localContent && skill._remoteContent) {
    return [...lines, ...renderSkillDiff(skill, width, maxHeight - lines.length - 1)]
  }

  // Description
  if (skill.description) {
    lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Description:${ANSI.reset}`)
    const descLines = wrapText(skill.description, contentWidth)
    for (const line of descLines.slice(0, 3)) { // Max 3 lines for description
      lines.push(`${ANSI.cyan}│${ANSI.reset} ${truncate(line, contentWidth)}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)
    }
  }

  // Author
  if (skill.author) {
    lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Author: ${ANSI.reset}${truncate(skill.author, contentWidth - 9)}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)
  }

  // Source
  lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Source: ${ANSI.reset}${truncate(skill._source, contentWidth - 9)}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)

  // Tags
  if (skill.tags && skill.tags.length > 0) {
    const tagsStr = skill.tags.map(t => `${ANSI.yellow}${t}${ANSI.reset}`).join(', ')
    lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Tags:${ANSI.reset} ${truncate(tagsStr, contentWidth - 7)}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)
  }

  // Targets
  if (skill.targets && skill.targets.length > 0) {
    const targetsStr = skill.targets.join(', ')
    lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Targets: ${ANSI.reset}${truncate(targetsStr, contentWidth - 10)}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)
  }

  // Path
  lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Path: ${ANSI.reset}${truncate(skill._path, contentWidth - 7)}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)

  return lines
}

/**
 * Render diff view for skill with update
 */
function renderSkillDiff(skill: SkillMeta, width: number, maxHeight: number): string[] {
  const lines: string[] = []
  const contentWidth = width - 4

  // Diff header
  lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.bold}${ANSI.yellow}Changes Available${ANSI.reset}`)
  lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Press 'r' to update${ANSI.reset}`)

  // Separator
  lines.push(`${ANSI.cyan}│${'─'.repeat(width - 2)}│${ANSI.reset}`)

  // Compute diff
  const diff = computeDiff(skill._localContent || '', skill._remoteContent || '')

  // Limit diff lines to fit panel
  const maxDiffLines = maxHeight - lines.length - 1
  const diffLines = diff.slice(0, Math.max(0, maxDiffLines))

  // Render diff lines with colors
  for (const diffLine of diffLines) {
    let lineContent = ''
    let displayLine = diffLine.content

    // Truncate long lines
    if (displayLine.length > contentWidth - 3) {
      displayLine = displayLine.slice(0, contentWidth - 4) + '…'
    }

    switch (diffLine.type) {
      case 'add':
        lineContent = `${ANSI.green}+ ${displayLine}${ANSI.reset}`
        break
      case 'remove':
        lineContent = `${ANSI.red}- ${displayLine}${ANSI.reset}`
        break
      case 'context':
        lineContent = `${ANSI.dim}  ${displayLine}${ANSI.reset}`
        break
    }

    // Pad and add borders
    const plainContent = lineContent.replace(/\x1b\[[0-9;]*m/g, '')
    const padding = ' '.repeat(Math.max(0, contentWidth - plainContent.length))
    lines.push(`${ANSI.cyan}│${ANSI.reset} ${lineContent}${padding}`.slice(0, width - 2) + `${ANSI.cyan}│${ANSI.reset}`)
  }

  // Show count if diff was truncated
  if (diff.length > maxDiffLines) {
    const remaining = diff.length - maxDiffLines
    lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}... ${remaining} more lines ...${ANSI.reset}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)
  }

  return lines
}

/**
 * Render source detail content
 */
function renderSourceDetail(source: SourceConfig, width: number, maxHeight: number): string[] {
  const lines: string[] = []
  const contentWidth = width - 4

  // Name
  lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.bold}${ANSI.green}${truncate(source.name, contentWidth)}${ANSI.reset}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)

  // Separator
  lines.push(`${ANSI.cyan}│${'─'.repeat(width - 2)}│${ANSI.reset}`)

  // Provider
  lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Provider: ${ANSI.reset}${truncate(source.provider, contentWidth - 11)}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)

  // URL
  if (source.url) {
    lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}URL: ${ANSI.reset}${truncate(source.url, contentWidth - 6)}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)
  }

  // Status
  const statusText = source.enabled ? `${ANSI.green}Enabled${ANSI.reset}` : `${ANSI.yellow}Disabled${ANSI.reset}`
  lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Status: ${ANSI.reset}${statusText}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)

  return lines
}

/**
 * Render target detail content
 */
function renderTargetDetail(target: TargetConfig, width: number, maxHeight: number): string[] {
  const lines: string[] = []
  const contentWidth = width - 4

  // Name
  lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.bold}${ANSI.green}${truncate(target.name, contentWidth)}${ANSI.reset}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)

  // Separator
  lines.push(`${ANSI.cyan}│${'─'.repeat(width - 2)}│${ANSI.reset}`)

  // Provider
  if (target.provider) {
    lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Provider: ${ANSI.reset}${truncate(target.provider, contentWidth - 11)}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)
  }

  // Status
  const statusText = target.enabled ? `${ANSI.green}Enabled${ANSI.reset}` : `${ANSI.yellow}Disabled${ANSI.reset}`
  lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Status: ${ANSI.reset}${statusText}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)

  // Description based on target name
  const descriptions: Record<string, string> = {
    'claude-code': 'Claude Code CLI - Anthropic official coding assistant',
    'cursor': 'Cursor IDE - AI-powered code editor',
    'opencode': 'OpenCode - Open source AI coding assistant',
  }

  if (descriptions[target.name]) {
    lines.push(`${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}Description: ${ANSI.reset}`)
    const descLines = wrapText(descriptions[target.name], contentWidth)
    for (const line of descLines) {
      lines.push(`${ANSI.cyan}│${ANSI.reset} ${truncate(line, contentWidth)}`.padEnd(width - 1) + `${ANSI.cyan}│${ANSI.reset}`)
    }
  }

  return lines
}

export interface StatusBarOptions {
  shortcuts: Array<{ key: string; action: string }>
  width: number
}

/**
 * Render the status bar with keyboard shortcuts
 */
export function renderStatusBar(options: StatusBarOptions): string {
  const { shortcuts, width } = options

  const shortcutTexts = shortcuts.map(s => `${ANSI.bold}${ANSI.yellow}${s.key}${ANSI.reset}${ANSI.dim}:${ANSI.reset} ${s.action}`)
  const fullText = shortcutTexts.join(` ${ANSI.dim}│${ANSI.reset} `)

  // Truncate if too long
  let displayText = fullText
  if (displayText.length > width - 2) {
    displayText = displayText.slice(0, width - 5) + '...'
  }

  return `${ANSI.inverse}${displayText.padEnd(width)}${ANSI.reset}`
}

/**
 * Truncate text to a maximum length
 */
function truncate(text: string, maxLength: number): string {
  // Remove ANSI codes for length calculation
  const plainText = text.replace(/\x1b\[[0-9;]*m/g, '')
  if (plainText.length <= maxLength) {
    return text
  }

  // Find where to truncate (accounting for ANSI codes)
  let visibleChars = 0
  let i = 0
  while (i < text.length && visibleChars < maxLength - 1) {
    if (text[i] === '\x1b') {
      // Skip ANSI escape sequence
      while (i < text.length && text[i] !== 'm') {
        i++
      }
      i++ // Skip the 'm'
    } else {
      visibleChars++
      i++
    }
  }

  return text.slice(0, i) + '…'
}

/**
 * Wrap text to fit within a maximum width
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) {
        lines.push(currentLine)
      }
      currentLine = word
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}
