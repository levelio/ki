// src/tui/app.ts
import * as p from '@clack/prompts'
import { loadConfig } from '../config'
import { providerRegistry } from '../providers'
import { targetRegistry } from '../targets'
import type { SkillMeta, Config, SourceConfig, TargetConfig } from '../types'
import { renderPanel, renderDetailPanel, renderStatusBar } from './components/panel'

// Panel types
export type PanelType = 'skills' | 'sources' | 'targets'

// App state interface
export interface AppState {
  config: Config
  skills: SkillMeta[]
  currentPanel: PanelType
  selectedIndex: number
  running: boolean
}

// Terminal size
let terminalWidth = process.stdout.columns || 80
let terminalHeight = process.stdout.rows || 24

// ANSI escape codes
const ANSI = {
  clear: '\x1b[2J',
  home: '\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  inverse: '\x1b[7m',
}

/**
 * Get current terminal dimensions
 */
function updateTerminalSize(): void {
  terminalWidth = process.stdout.columns || 80
  terminalHeight = process.stdout.rows || 24
}

/**
 * Clear screen and move cursor to home
 */
function clearScreen(): void {
  process.stdout.write(ANSI.clear + ANSI.home)
}

/**
 * Render the full TUI layout
 */
function render(state: AppState): void {
  clearScreen()
  updateTerminalSize()

  const leftWidth = Math.floor(terminalWidth * 0.35)
  const rightWidth = terminalWidth - leftWidth - 3 // 3 for separators
  const headerHeight = 2 // Header + blank line
  const statusBarHeight = 2 // Status bar + blank line
  const availableHeight = terminalHeight - headerHeight - statusBarHeight

  // Calculate heights for each left panel (3 panels)
  const panelCount = 3
  const eachPanelHeight = Math.floor(availableHeight / panelCount)

  // Render header
  console.log(`${ANSI.bold}${ANSI.cyan}LazySkill${ANSI.reset} - Cross-tool skill manager`)
  console.log('')

  // Get items for each panel
  const skillItems = state.skills.map(s => s.name)
  const sourceItems = state.config.sources.map(s => `${s.name}${s.enabled ? '' : ' (disabled)'}`)
  const targetItems = state.config.targets.map(t => `${t.name}${t.enabled ? '' : ' (disabled)'}`)

  // Skills panel
  const skillsPanel = renderPanel({
    title: 'SKILLS',
    items: skillItems,
    selected: state.currentPanel === 'skills' ? state.selectedIndex : -1,
    width: leftWidth,
    height: eachPanelHeight,
    active: state.currentPanel === 'skills',
  })

  // Sources panel
  const sourcesPanel = renderPanel({
    title: 'SOURCES',
    items: sourceItems,
    selected: state.currentPanel === 'sources' ? state.selectedIndex : -1,
    width: leftWidth,
    height: eachPanelHeight,
    active: state.currentPanel === 'sources',
  })

  // Targets panel
  const targetsPanel = renderPanel({
    title: 'TARGETS',
    items: targetItems,
    selected: state.currentPanel === 'targets' ? state.selectedIndex : -1,
    width: leftWidth,
    height: eachPanelHeight,
    active: state.currentPanel === 'targets',
  })

  // Get selected item for detail panel
  let selectedItem: SkillMeta | SourceConfig | TargetConfig | null = null
  if (state.currentPanel === 'skills' && state.skills[state.selectedIndex]) {
    selectedItem = state.skills[state.selectedIndex]
  } else if (state.currentPanel === 'sources' && state.config.sources[state.selectedIndex]) {
    selectedItem = state.config.sources[state.selectedIndex]
  } else if (state.currentPanel === 'targets' && state.config.targets[state.selectedIndex]) {
    selectedItem = state.config.targets[state.selectedIndex]
  }

  // Render detail panel
  const detailPanel = renderDetailPanel({
    title: 'DETAILS',
    item: selectedItem,
    type: state.currentPanel,
    width: rightWidth,
    height: availableHeight,
  })

  // Build output by combining panels line by line
  let output = ''
  let leftLineIndex = 0

  // Combine all left panels
  const allLeftLines = [...skillsPanel, ...sourcesPanel, ...targetsPanel]
  const maxLines = Math.max(allLeftLines.length, detailPanel.length)

  for (let i = 0; i < maxLines; i++) {
    const leftLine = allLeftLines[i] || ' '.repeat(leftWidth)
    const rightLine = detailPanel[i] || ' '.repeat(rightWidth)

    // Pad lines to correct width (stripping ANSI codes for length calculation)
    const paddedLeft = padLine(leftLine, leftWidth)
    const paddedRight = padLine(rightLine, rightWidth)

    output += paddedLeft + ' │ ' + paddedRight + '\n'
  }

  process.stdout.write(output)

  // Render status bar
  const statusBar = renderStatusBar({
    shortcuts: [
      { key: 'Tab', action: 'Switch panel' },
      { key: '↑/↓', action: 'Navigate' },
      { key: 'Enter', action: 'Select' },
      { key: 'i', action: 'Install' },
      { key: 'u', action: 'Uninstall' },
      { key: '/', action: 'Search' },
      { key: 'r', action: 'Refresh' },
      { key: 'q', action: 'Quit' },
    ],
    width: terminalWidth,
  })

  process.stdout.write('\n' + statusBar)
}

/**
 * Pad a line to a specific width, accounting for ANSI codes
 */
function padLine(line: string, width: number): string {
  // Calculate visible length (excluding ANSI codes)
  const visibleLength = line.replace(/\x1b\[[0-9;]*m/g, '').length

  if (visibleLength >= width) {
    return line
  }

  // Add padding
  return line + ' '.repeat(width - visibleLength)
}

/**
 * Handle keyboard input
 */
function handleKey(key: string, state: AppState): void {
  switch (key) {
    case 'q':
    case '\x03': // Ctrl+C
      state.running = false
      break

    case '\t': // Tab - switch panel
      const panels: PanelType[] = ['skills', 'sources', 'targets']
      const currentIndex = panels.indexOf(state.currentPanel)
      state.currentPanel = panels[(currentIndex + 1) % panels.length]
      state.selectedIndex = 0
      break

    case '\x1b[A': // Up arrow
    case 'k':
      if (state.selectedIndex > 0) {
        state.selectedIndex--
      }
      break

    case '\x1b[B': // Down arrow
    case 'j':
      const maxIndex = getMaxIndex(state)
      if (state.selectedIndex < maxIndex) {
        state.selectedIndex++
      }
      break

    case '\r': // Enter
    case '\n':
      handleSelect(state)
      break

    case 'i':
      handleInstall(state)
      break

    case 'u':
      handleUninstall(state)
      break

    case 'r':
      handleRefresh(state)
      break

    case '/':
      // TODO: Implement search in Task 15.1
      break
  }
}

/**
 * Get max index for current panel
 */
function getMaxIndex(state: AppState): number {
  switch (state.currentPanel) {
    case 'skills':
      return state.skills.length - 1
    case 'sources':
      return state.config.sources.length - 1
    case 'targets':
      return state.config.targets.length - 1
  }
}

/**
 * Handle selection (Enter key)
 */
async function handleSelect(state: AppState): Promise<void> {
  if (state.currentPanel === 'skills' && state.skills[state.selectedIndex]) {
    const skill = state.skills[state.selectedIndex]
    // Show skill details - could open a modal or switch to detail view
    // For now, just a visual indicator
  }
}

/**
 * Handle install action
 */
async function handleInstall(state: AppState): Promise<void> {
  if (state.currentPanel === 'skills' && state.skills[state.selectedIndex]) {
    const skill = state.skills[state.selectedIndex]

    // Show a quick message
    process.stdout.write('\x1b[s') // Save cursor
    process.stdout.write(`\x1b[${terminalHeight};0H`) // Move to bottom
    process.stdout.write(`${ANSI.yellow}Installing ${skill.name}...${ANSI.reset}`)
    process.stdout.write('\x1b[u') // Restore cursor

    try {
      // Find source config for this skill
      const sourceConfig = state.config.sources.find(s => s.name === skill._source)
      if (sourceConfig) {
        const content = await providerRegistry.fetchContent(skill, sourceConfig)
        await targetRegistry.installToAll(
          content,
          state.config.targets.filter(t => t.enabled),
          'global'
        )

        process.stdout.write('\x1b[s')
        process.stdout.write(`\x1b[${terminalHeight};0H`)
        process.stdout.write(`${ANSI.green}Installed ${skill.name} successfully!${ANSI.reset}  `)
        process.stdout.write('\x1b[u')
      }
    } catch (error) {
      process.stdout.write('\x1b[s')
      process.stdout.write(`\x1b[${terminalHeight};0H`)
      process.stdout.write(`${ANSI.reset}Failed to install: ${error}${ANSI.reset}  `)
      process.stdout.write('\x1b[u')
    }
  }
}

/**
 * Handle uninstall action
 */
async function handleUninstall(state: AppState): Promise<void> {
  if (state.currentPanel === 'skills' && state.skills[state.selectedIndex]) {
    const skill = state.skills[state.selectedIndex]

    process.stdout.write('\x1b[s')
    process.stdout.write(`\x1b[${terminalHeight};0H`)
    process.stdout.write(`${ANSI.yellow}Uninstalling ${skill.name}...${ANSI.reset}`)
    process.stdout.write('\x1b[u')

    try {
      await targetRegistry.uninstallFromAll(
        skill.id,
        state.config.targets.filter(t => t.enabled),
        'global'
      )

      process.stdout.write('\x1b[s')
      process.stdout.write(`\x1b[${terminalHeight};0H`)
      process.stdout.write(`${ANSI.green}Uninstalled ${skill.name} successfully!${ANSI.reset}  `)
      process.stdout.write('\x1b[u')
    } catch (error) {
      process.stdout.write('\x1b[s')
      process.stdout.write(`\x1b[${terminalHeight};0H`)
      process.stdout.write(`${ANSI.reset}Failed to uninstall: ${error}${ANSI.reset}  `)
      process.stdout.write('\x1b[u')
    }
  }
}

/**
 * Handle refresh action
 */
async function handleRefresh(state: AppState): Promise<void> {
  process.stdout.write('\x1b[s')
  process.stdout.write(`\x1b[${terminalHeight};0H`)
  process.stdout.write(`${ANSI.yellow}Refreshing skills...${ANSI.reset}`)
  process.stdout.write('\x1b[u')

  try {
    state.skills = await providerRegistry.discoverAll(state.config.sources)
    state.selectedIndex = Math.min(state.selectedIndex, state.skills.length - 1)

    process.stdout.write('\x1b[s')
    process.stdout.write(`\x1b[${terminalHeight};0H`)
    process.stdout.write(`${ANSI.green}Refreshed! Found ${state.skills.length} skills.${ANSI.reset}  `)
    process.stdout.write('\x1b[u')
  } catch (error) {
    process.stdout.write('\x1b[s')
    process.stdout.write(`\x1b[${terminalHeight};0H`)
    process.stdout.write(`${ANSI.reset}Failed to refresh: ${error}${ANSI.reset}  `)
    process.stdout.write('\x1b[u')
  }
}

/**
 * Set up raw keyboard input
 */
function setupInput(onKey: (key: string) => void): () => void {
  // Save original settings
  const originalRawMode = process.stdin.isRaw
  const originalEncoding = process.stdin.readableEncoding

  // Set up raw mode
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  // Hide cursor
  process.stdout.write(ANSI.hideCursor)

  // Handle input
  const onData = (data: string) => {
    onKey(data)
  }

  process.stdin.on('data', onData)

  // Return cleanup function
  return () => {
    process.stdin.off('data', onData)
    if (process.stdin.isTTY && originalRawMode !== undefined) {
      process.stdin.setRawMode(originalRawMode)
    }
    process.stdout.write(ANSI.showCursor)
    process.stdin.pause()
  }
}

/**
 * Handle terminal resize
 */
function setupResize(onResize: () => void): () => void {
  process.stdout.on('resize', onResize)
  return () => {
    process.stdout.off('resize', onResize)
  }
}

/**
 * Main entry point for the TUI
 */
export async function runApp(): Promise<void> {
  // Load config and skills
  const config = await loadConfig()

  p.intro(`${ANSI.cyan}Loading LazySkill...${ANSI.reset}`)

  const skills = await providerRegistry.discoverAll(config.sources)

  const state: AppState = {
    config,
    skills,
    currentPanel: 'skills',
    selectedIndex: 0,
    running: true,
  }

  if (skills.length === 0) {
    p.note('No skills found. Add sources to your config at ~/.config/lazyskill/config.yaml')
    p.outro('Goodbye!')
    return
  }

  // Set up input handling
  const cleanupInput = setupInput((key) => {
    handleKey(key, state)

    if (state.running) {
      render(state)
    }
  })

  // Set up resize handling
  const cleanupResize = setupResize(() => {
    if (state.running) {
      render(state)
    }
  })

  // Initial render
  render(state)

  // Wait until running is false
  await new Promise<void>((resolve) => {
    const checkRunning = setInterval(() => {
      if (!state.running) {
        clearInterval(checkRunning)
        resolve()
      }
    }, 100)
  })

  // Cleanup
  cleanupInput()
  cleanupResize()
  clearScreen()

  p.outro(`${ANSI.cyan}Goodbye!${ANSI.reset}`)
}
