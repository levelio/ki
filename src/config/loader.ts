import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Config, TargetConfig } from '@/types'
import { DEFAULT_CONFIG } from '@/types'
import type { SourceConfig } from '@/types'
// src/config/loader.ts
import { parse, stringify } from 'yaml'

export const CONFIG_DIR = join(homedir(), '.config', 'ki')
export const CONFIG_FILE = join(CONFIG_DIR, 'config.yaml')

export interface ConfigOverride {
  sources?: Partial<SourceConfig>[]
  targets?: Partial<TargetConfig>[]
}

export async function loadConfig(): Promise<Config> {
  // Start with default config
  let config = {
    ...DEFAULT_CONFIG,
    sources: [...DEFAULT_CONFIG.sources],
    targets: [...DEFAULT_CONFIG.targets],
  }

  // Try to load user config
  if (existsSync(CONFIG_FILE)) {
    try {
      const content = await readFile(CONFIG_FILE, 'utf-8')
      const userConfig = parse(content) as ConfigOverride

      // Merge configs
      config = mergeConfig(config, userConfig)
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  } else {
    // Create default config file if not exists
    await saveConfig(config)
  }

  return config
}

export async function saveConfig(config: Config): Promise<void> {
  // Ensure directory exists
  await mkdir(CONFIG_DIR, { recursive: true })

  const content = stringify(config)
  await writeFile(CONFIG_FILE, content, 'utf-8')
}

export function mergeConfig(defaults: Config, user: ConfigOverride): Config {
  return {
    sources: mergeArrays(defaults.sources, user.sources || [], 'name'),
    targets: mergeArrays(defaults.targets, user.targets || [], 'name'),
  }
}

function hasStringKey<T extends { name: string }>(
  item: Partial<T>,
  key: keyof T,
): item is Partial<T> & Pick<T, typeof key> {
  return typeof item[key] === 'string' && item[key] !== ''
}

export function mergeArrays<T extends { name: string }>(
  defaults: T[],
  user: Partial<T>[],
  key: keyof T,
): T[] {
  const result = [...defaults]
  const validUserItems = user.filter(
    (item): item is Partial<T> & Pick<T, typeof key> => hasStringKey(item, key),
  )
  const userMap = new Map(validUserItems.map((item) => [item[key], item]))

  for (const [name, userItem] of userMap) {
    const defaultIndex = result.findIndex((item) => item[key] === name)

    if (defaultIndex >= 0) {
      // Merge with default
      result[defaultIndex] = { ...result[defaultIndex], ...userItem } as T
    } else {
      // Add new item (need to ensure required fields exist)
      result.push(userItem as T)
    }
  }

  return result
}

export function getConfigDir(): string {
  return CONFIG_DIR
}

export function getCacheDir(): string {
  return join(CONFIG_DIR, 'cache')
}
