// src/types/provider.ts
import type { SkillContent, SkillMeta } from './skill'

export interface SourceConfig {
  name: string
  provider: string
  url: string
  options?: Record<string, unknown>
  enabled: boolean
}

export interface Provider {
  name: string
  discover(config: SourceConfig): Promise<SkillMeta[]>
  fetchSkillContent(skill: SkillMeta): Promise<SkillContent>
  sync?(config: SourceConfig): Promise<void>
  checkForUpdates?(config: SourceConfig): Promise<boolean>
}
