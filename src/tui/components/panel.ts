// src/tui/components/panel.ts

export interface PanelOptions {
  title: string
  items: string[]
  selected: number
  width: number
}

export function renderPanel(options: PanelOptions): string[] {
  const { title, items, selected, width } = options
  const lines: string[] = []

  // Title
  lines.push(`┌─ ${title} ${'─'.repeat(Math.max(0, width - title.length - 4))}`)

  // Items
  for (let i = 0; i < items.length; i++) {
    const prefix = i === selected ? '◉' : ' '
    const item = items[i].slice(0, width - 4)
    lines.push(`│ ${prefix} ${item.padEnd(width - 4)}`)
  }

  // Padding
  while (lines.length < 10) {
    lines.push(`│ ${' '.repeat(width - 4)}`)
  }

  lines.push(`└${'─'.repeat(width - 1)}`)

  return lines
}
