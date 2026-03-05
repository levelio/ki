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
  // Search state
  searchMode: boolean
  searchQuery: string
  filteredSkills: SkillMeta[]
  // Visual mode state
  visualMode: boolean
  visualStart: number
  visualEnd: number
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
  red: '\x1b[31m',
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
 * Filter skills based on search query
 */
function filterSkills(skills: SkillMeta[], query: string): SkillMeta[] {
  if (!query) return skills
  const q = query.toLowerCase()
  return skills.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.id.toLowerCase().includes(q) ||
    (s.description && s.description.toLowerCase().includes(q))
  )
}

/**
 * Get selected indices in visual mode
 */
function getVisualSelection(state: AppState): number[] {
  if (!state.visualMode) return [state.selectedIndex]
  const start = Math.min(state.visualStart, state.visualEnd)
  const end = Math.max(state.visualStart, state.visualEnd)
  const indices: number[] = []
  for (let i = start; i <= end; i++) {
    indices.push(i)
  }
  return indices
}

/**
 * Get count of selected items
 */
function getSelectedCount(state: AppState): number {
  return getVisualSelection(state).length
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

  // Render header with search/visual mode indicator
  if (state.searchMode) {
    const searchPrompt = `${ANSI.bold}${ANSI.cyan}LazySkill${ANSI.reset} - Search: ${ANSI.yellow}${state.searchQuery}${ANSI.reset}${ANSI.inverse} ${ANSI.reset}`
    console.log(searchPrompt)
  } else if (state.visualMode) {
    const selectedCount = getSelectedCount(state)
    console.log(`${ANSI.bold}${ANSI.cyan}LazySkill${ANSI.reset} - ${ANSI.magenta}[VISUAL]${ANSI.reset} ${ANSI.yellow}${selectedCount} selected${ANSI.reset}`)
  } else if (state.searchQuery) {
    console.log(`${ANSI.bold}${ANSI.cyan}LazySkill${ANSI.reset} - Cross-tool skill manager ${ANSI.dim}[Search: ${state.searchQuery}]${ANSI.reset}`)
  } else {
    console.log(`${ANSI.bold}${ANSI.cyan}LazySkill${ANSI.reset} - Cross-tool skill manager`)
  }
  console.log('')

  // Get filtered or all skills based on search query
  const displaySkills = state.searchQuery ? state.filteredSkills : state.skills

  // Get items for each panel
  const skillItems = displaySkills.map(s => s.name)
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
    visualMode: state.visualMode && state.currentPanel === 'skills',
    visualStart: state.visualStart,
    visualEnd: state.visualEnd,
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
  if (state.currentPanel === 'skills' && displaySkills[state.selectedIndex]) {
    selectedItem = displaySkills[state.selectedIndex]
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
    shortcuts: state.visualMode ? [
      { key: 'j/k', action: 'Extend selection' },
      { key: 'i', action: 'Install selected' },
      { key: 'u', action: 'Uninstall selected' },
      { key: 'Esc', action: 'Exit visual' },
    ] : [
      { key: 'Tab', action: 'Switch panel' },
      { key: '↑/↓', action: 'Navigate' },
      { key: 'v', action: 'Visual mode' },
      { key: 'i', action: 'Install' },
      { key: 'u', action: 'Uninstall' },
      { key: '/', action: 'Search' },
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
  // Handle search mode input
  if (state.searchMode) {
    handleSearchModeKey(key, state)
    return
  }

  // Handle Escape key to exit visual mode
  if (key === '\x1b' && state.visualMode) {
    state.visualMode = false
    return
  }

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
      // Exit visual mode when switching panels
      state.visualMode = false
      break

    case '\x1b[A': // Up arrow
    case 'k':
      if (state.selectedIndex > 0) {
        state.selectedIndex--
        // In visual mode, extend selection
        if (state.visualMode) {
          state.visualEnd = state.selectedIndex
        }
      }
      break

    case '\x1b[B': // Down arrow
    case 'j':
      const maxIndex = getMaxIndex(state)
      if (state.selectedIndex < maxIndex) {
        state.selectedIndex++
        // In visual mode, extend selection
        if (state.visualMode) {
          state.visualEnd = state.selectedIndex
        }
      }
      break

    case '\r': // Enter
    case '\n':
      handleSelect(state)
      break

    case 'v':
      // Toggle visual mode (only in skills panel)
      if (state.currentPanel === 'skills') {
        if (state.visualMode) {
          // Exit visual mode
          state.visualMode = false
        } else {
          // Enter visual mode
          state.visualMode = true
          state.visualStart = state.selectedIndex
          state.visualEnd = state.selectedIndex
        }
      }
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
      // Enter search mode
      state.searchMode = true
      state.searchQuery = ''
      state.currentPanel = 'skills' // Search only works in skills panel
      state.visualMode = false // Exit visual mode when entering search
      break
  }
}

/**
 * Handle keyboard input in search mode
 */
function handleSearchModeKey(key: string, state: AppState): void {
  switch (key) {
    case '\x1b': // Escape - cancel search
      state.searchMode = false
      state.searchQuery = ''
      state.filteredSkills = []
      state.selectedIndex = 0
      break

    case '\r': // Enter - confirm search
    case '\n':
      state.searchMode = false
      // Keep the search query and filtered results
      break

    case '\x7f': // Backspace
    case '\b':
      if (state.searchQuery.length > 0) {
        state.searchQuery = state.searchQuery.slice(0, -1)
        updateFilteredSkills(state)
      }
      break

    default:
      // Add printable characters to search query
      if (key.length === 1 && key >= ' ' && key <= '~') {
        state.searchQuery += key
        updateFilteredSkills(state)
      }
      break
  }
}

/**
 * Update filtered skills based on current search query
 */
function updateFilteredSkills(state: AppState): void {
  if (state.searchQuery) {
    state.filteredSkills = filterSkills(state.skills, state.searchQuery)
    // Reset selection if it's out of bounds
    if (state.selectedIndex >= state.filteredSkills.length) {
      state.selectedIndex = Math.max(0, state.filteredSkills.length - 1)
    }
  } else {
    state.filteredSkills = []
    state.selectedIndex = 0
  }
}

/**
 * Get max index for current panel
 */
function getMaxIndex(state: AppState): number {
  const displaySkills = state.searchQuery ? state.filteredSkills : state.skills
  switch (state.currentPanel) {
    case 'skills':
      return displaySkills.length - 1
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
  const displaySkills = state.searchQuery ? state.filteredSkills : state.skills

  if (state.currentPanel === 'skills') {
    // Get selected indices (single or multiple in visual mode)
    const selectedIndices = state.visualMode ? getVisualSelection(state) : [state.selectedIndex]
    const skillsToInstall = selectedIndices
      .map(i => displaySkills[i])
      .filter((s): s is SkillMeta => s !== undefined)

    if (skillsToInstall.length === 0) return

    const skillCount = skillsToInstall.length
    const skillNames = skillsToInstall.map(s => s.name).join(', ')

    // Show a quick message
    process.stdout.write('\x1b[s') // Save cursor
    process.stdout.write(`\x1b[${terminalHeight};0H`) // Move to bottom
    if (skillCount === 1) {
      process.stdout.write(`${ANSI.yellow}Installing ${skillsToInstall[0].name}...${ANSI.reset}`)
    } else {
      process.stdout.write(`${ANSI.yellow}Installing ${skillCount} skills...${ANSI.reset}`)
    }
    process.stdout.write('\x1b[u') // Restore cursor

    let successCount = 0
    let failCount = 0

    for (const skill of skillsToInstall) {
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
          successCount++
        }
      } catch (error) {
        failCount++
      }
    }

    process.stdout.write('\x1b[s')
    process.stdout.write(`\x1b[${terminalHeight};0H`)
    if (failCount === 0) {
      if (skillCount === 1) {
        process.stdout.write(`${ANSI.green}Installed ${skillsToInstall[0].name} successfully!${ANSI.reset}  `)
      } else {
        process.stdout.write(`${ANSI.green}Installed ${successCount}/${skillCount} skills successfully!${ANSI.reset}  `)
      }
    } else {
      process.stdout.write(`${ANSI.yellow}Installed ${successCount}/${skillCount} (${failCount} failed)${ANSI.reset}  `)
    }
    process.stdout.write('\x1b[u')

    // Exit visual mode after action
    state.visualMode = false
  }
}

/**
 * Handle uninstall action
 */
async function handleUninstall(state: AppState): Promise<void> {
  const displaySkills = state.searchQuery ? state.filteredSkills : state.skills

  if (state.currentPanel === 'skills') {
    // Get selected indices (single or multiple in visual mode)
    const selectedIndices = state.visualMode ? getVisualSelection(state) : [state.selectedIndex]
    const skillsToUninstall = selectedIndices
      .map(i => displaySkills[i])
      .filter((s): s is SkillMeta => s !== undefined)

    if (skillsToUninstall.length === 0) return

    const skillCount = skillsToUninstall.length

    process.stdout.write('\x1b[s')
    process.stdout.write(`\x1b[${terminalHeight};0H`)
    if (skillCount === 1) {
      process.stdout.write(`${ANSI.yellow}Uninstalling ${skillsToUninstall[0].name}...${ANSI.reset}`)
    } else {
      process.stdout.write(`${ANSI.yellow}Uninstalling ${skillCount} skills...${ANSI.reset}`)
    }
    process.stdout.write('\x1b[u')

    let successCount = 0
    let failCount = 0

    for (const skill of skillsToUninstall) {
      try {
        await targetRegistry.uninstallFromAll(
          skill.id,
          state.config.targets.filter(t => t.enabled),
          'global'
        )
        successCount++
      } catch (error) {
        failCount++
      }
    }

    process.stdout.write('\x1b[s')
    process.stdout.write(`\x1b[${terminalHeight};0H`)
    if (failCount === 0) {
      if (skillCount === 1) {
        process.stdout.write(`${ANSI.green}Uninstalled ${skillsToUninstall[0].name} successfully!${ANSI.reset}  `)
      } else {
        process.stdout.write(`${ANSI.green}Uninstalled ${successCount}/${skillCount} skills successfully!${ANSI.reset}  `)
      }
    } else {
      process.stdout.write(`${ANSI.yellow}Uninstalled ${successCount}/${skillCount} (${failCount} failed)${ANSI.reset}  `)
    }
    process.stdout.write('\x1b[u')

    // Exit visual mode after action
    state.visualMode = false
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
    // Search state
    searchMode: false,
    searchQuery: '',
    filteredSkills: [],
    // Visual mode state
    visualMode: false,
    visualStart: 0,
    visualEnd: 0,
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
