import { describe, expect, it, vi } from 'vitest'
import {
  buildGlobalInstallReminderMessage,
  runPostinstallReminder,
  shouldShowGlobalInstallReminder,
} from '../scripts/postinstall-reminder.mjs'

describe('postinstall reminder', () => {
  it('shows the reminder for npm global installs', () => {
    expect(shouldShowGlobalInstallReminder({ npm_config_global: 'true' })).toBe(
      true,
    )
    expect(
      shouldShowGlobalInstallReminder({ npm_config_location: 'global' }),
    ).toBe(true)
  })

  it('does not show the reminder for local or ambiguous installs', () => {
    expect(
      shouldShowGlobalInstallReminder({ npm_config_global: 'false' }),
    ).toBe(false)
    expect(
      shouldShowGlobalInstallReminder({ npm_config_location: 'user' }),
    ).toBe(false)
    expect(shouldShowGlobalInstallReminder({})).toBe(false)
  })

  it('prints the expected reminder text for global installs', () => {
    const log = vi.fn()

    const result = runPostinstallReminder({
      env: { npm_config_global: 'true' },
      log,
    })

    expect(result).toBe(true)
    expect(log).toHaveBeenCalledWith(buildGlobalInstallReminderMessage())
    expect(buildGlobalInstallReminderMessage()).toContain('ki init')
    expect(buildGlobalInstallReminderMessage()).toContain('ki source sync ki')
  })

  it('stays silent for non-global installs', () => {
    const log = vi.fn()

    const result = runPostinstallReminder({
      env: { npm_config_global: 'false' },
      log,
    })

    expect(result).toBe(false)
    expect(log).not.toHaveBeenCalled()
  })
})
