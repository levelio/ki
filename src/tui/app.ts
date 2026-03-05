// src/tui/app.ts
import * as p from '@clack/prompts'
import { loadConfig } from '../config'
import { providerRegistry } from '../providers'
import type { SkillMeta, Config } from '../types'

export interface AppState {
  config: Config
  skills: SkillMeta[]
  currentPanel: 'skills' | 'sources' | 'targets'
  selectedIndex: number
  visualMode: boolean
  visualStart: number
  searchQuery: string
  searchMode: boolean
}

export async function runApp(): Promise<void> {
  // Load config and skills
  const config = await loadConfig()
  const skills = await providerRegistry.discoverAll(config.sources)

  const state: AppState = {
    config,
    skills,
    currentPanel: 'skills',
    selectedIndex: 0,
    visualMode: false,
    visualStart: 0,
    searchQuery: '',
    searchMode: false,
  }

  // For now, just display a simple list
  p.intro('LazySkill')

  if (skills.length === 0) {
    p.note('No skills found. Add sources to your config at ~/.config/lazyskill/config.yaml')
    p.outro('Goodbye!')
    return
  }

  const skillItems = skills.map(s => ({
    value: s.id,
    label: `${s.name} (${s._source})`
  }))

  const selected = await p.select({
    message: 'Select a skill',
    options: skillItems,
  })

  if (p.isCancel(selected)) {
    p.outro('Goodbye!')
    return
  }

  const skill = skills.find(s => s.id === selected)
  if (skill) {
    console.log(`\nSkill: ${skill.name}`)
    console.log(`Source: ${skill._source}`)
    console.log(`Description: ${skill.description || 'No description'}`)
  }

  p.outro('Done!')
}
