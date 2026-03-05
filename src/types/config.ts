// src/types/config.ts
import type { SourceConfig } from './provider'

export interface TargetConfig {
  name: string
  provider?: string
  enabled: boolean
}

export interface Config {
  sources: SourceConfig[]
  targets: TargetConfig[]
}

export const DEFAULT_CONFIG: Config = {
  sources: [
    {
      name: 'superpowers',
      provider: 'superpowers',
      url: 'github.com/sst/superpowers-marketplace',
      enabled: true,
    },
  ],
  targets: [
    { name: 'claude-code', enabled: true },
    { name: 'cursor', enabled: true },
    { name: 'opencode', enabled: true },
  ],
}
