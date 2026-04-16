import { homedir, platform } from 'node:os'
import { join } from 'node:path'

interface ConfigPathDeps {
  env?: NodeJS.ProcessEnv
  homedir?: () => string
  platform?: () => NodeJS.Platform
}

function getConfigRoot(overrides: ConfigPathDeps = {}): string {
  const env = overrides.env ?? process.env
  const getHome = overrides.homedir ?? homedir
  const getPlatform = overrides.platform ?? platform
  const currentPlatform = getPlatform()

  if (currentPlatform === 'win32') {
    return env.APPDATA || join(getHome(), 'AppData', 'Roaming')
  }

  if (currentPlatform === 'linux' && env.XDG_CONFIG_HOME) {
    return env.XDG_CONFIG_HOME
  }

  return join(getHome(), '.config')
}

export function getKiConfigDir(overrides: ConfigPathDeps = {}): string {
  return join(getConfigRoot(overrides), 'ki')
}

export function getKiConfigFile(overrides: ConfigPathDeps = {}): string {
  return join(getKiConfigDir(overrides), 'config.yaml')
}

export function getKiCacheDir(overrides: ConfigPathDeps = {}): string {
  return join(getKiConfigDir(overrides), 'cache')
}

export function getKiInstalledFile(overrides: ConfigPathDeps = {}): string {
  return join(getKiConfigDir(overrides), 'installed.json')
}
