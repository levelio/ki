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

export interface CliFlags {
  _?: string[]
  t?: string | boolean
  target?: string | boolean
  interactive?: boolean
  project?: boolean
  global?: boolean
  'dry-run'?: boolean
  installed?: boolean
  source?: string
  [key: string]: string | boolean | string[] | undefined
}

export const DEFAULT_CONFIG: Config = {
  sources: [
    {
      name: 'superpowers',
      provider: 'git',
      url: 'https://github.com/obra/superpowers.git',
      options: {
        skillsPath: 'skills',
        structure: 'nested',
        skillFile: 'SKILL.md',
        branch: 'main',
      },
      enabled: true,
    },
    {
      name: 'ki',
      provider: 'git',
      url: 'https://github.com/levelio/ki.git',
      options: {
        skillsPath: 'skills',
        structure: 'nested',
        skillFile: 'SKILL.md',
        branch: 'main',
      },
      enabled: true,
    },
  ],
  targets: [
    { name: 'claude-code', enabled: true },
    { name: 'codex', enabled: true },
    { name: 'cursor', enabled: true },
  ],
}
