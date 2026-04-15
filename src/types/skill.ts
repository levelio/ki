// src/types/skill.ts

export interface SkillMeta {
  id: string
  name: string
  description?: string
  author?: string
  targets?: string[]
  tags?: string[]

  // Internal use
  _source: string
  _path: string

  // Update tracking
  _hasUpdate?: boolean
  _localChecksum?: string
  _remoteChecksum?: string
  _localContent?: string
  _remoteContent?: string
}

export interface SkillContent {
  id: string
  content: string
  checksum: string
  sourcePath?: string // Path to original SKILL.md file (for file symlink)
  sourceDir?: string // Path to original skill directory (for directory symlink)
}

export interface InstalledSkill {
  id: string
  source: string
  target: string
  scope: 'global' | 'project'
  checksum: string
  installedAt: string
  enabled: boolean
}

export type SkillStatus =
  | 'not_installed'
  | 'installed'
  | 'disabled'
  | 'local'
  | 'update_available'
