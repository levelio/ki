import { describe, expect, it } from 'vitest'
import {
  getKiCacheDir,
  getKiConfigDir,
  getKiConfigFile,
  getKiInstalledFile,
} from '../../src/config'

describe('platform config paths', () => {
  it('uses XDG_CONFIG_HOME on Linux when available', () => {
    const overrides = {
      env: { XDG_CONFIG_HOME: '/tmp/xdg-config' },
      homedir: () => '/home/tester',
      platform: () => 'linux' as const,
    }

    expect(getKiConfigDir(overrides)).toBe('/tmp/xdg-config/ki')
    expect(getKiConfigFile(overrides)).toBe('/tmp/xdg-config/ki/config.yaml')
    expect(getKiCacheDir(overrides)).toBe('/tmp/xdg-config/ki/cache')
    expect(getKiInstalledFile(overrides)).toBe(
      '/tmp/xdg-config/ki/installed.json',
    )
  })

  it('uses APPDATA on Windows when available', () => {
    const overrides = {
      env: { APPDATA: 'C:\\Users\\tester\\AppData\\Roaming' },
      homedir: () => 'C:\\Users\\tester',
      platform: () => 'win32' as const,
    }

    expect(getKiConfigDir(overrides)).toBe(
      'C:\\Users\\tester\\AppData\\Roaming/ki',
    )
    expect(getKiConfigFile(overrides)).toBe(
      'C:\\Users\\tester\\AppData\\Roaming/ki/config.yaml',
    )
  })
})
