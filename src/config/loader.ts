// src/config/loader.ts
import { parse, stringify } from 'yaml'
import { existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { Config, TargetConfig } from '@/types'
import { DEFAULT_CONFIG } from '@/types'
import type { SourceConfig } from '@/types'

const CONFIG_DIR = join(homedir(), '.config', 'lazyskill')
const CONFIG_FILE = join(CONFIG_DIR, 'config.yaml')

export async function loadConfig(): Promise<Config> {
  // Start with default config
  let config = { ...DEFAULT_CONFIG, sources: [...DEFAULT_CONFIG.sources], targets: [...DEFAULT_CONFIG.targets] }

  // Try to load user config
  if (existsSync(CONFIG_FILE)) {
    try {
      const content = await readFile(CONFIG_FILE, 'utf-8')
      const userConfig = parse(content) as Partial<Config>

      // Merge configs
      config = mergeConfig(config, userConfig)
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  return config
}

export async function saveConfig(config: Config): Promise<void> {
  // Ensure directory exists
  await mkdir(CONFIG_DIR, { recursive: true })

  const content = stringify(config)
  await writeFile(CONFIG_FILE, content, 'utf-8')
}

function mergeConfig(defaults: Config, user: Partial<Config>): Config {
  return {
    sources: mergeArrays(defaults.sources, user.sources || [], 'name'),
    targets: mergeArrays(defaults.targets, user.targets || [], 'name'),
  }
}

function mergeArrays<T extends { name: string }>(
  defaults: T[],
  user: Partial<T>[],
  key: keyof T
): T[] {
  const result = [...defaults]
  const userMap = new Map(user.map(item => [item[key], item]))

  for (const [name, userItem] of userMap) {
    const defaultIndex = result.findIndex(item => item[key] === name)

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
