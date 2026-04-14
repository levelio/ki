import { describe, expect, it } from 'vitest'

function requiresChangeset(summary: string): boolean {
  return summary.trim().length > 0
}

function releasePrTitle(): string {
  return 'chore: release'
}

describe('changesets release workflow helpers', () => {
  it('treats non-empty user-facing summaries as changeset-worthy', () => {
    expect(requiresChangeset('add npm publish workflow')).toBe(true)
    expect(requiresChangeset('  ')).toBe(false)
  })

  it('uses the expected release PR title', () => {
    expect(releasePrTitle()).toBe('chore: release')
  })
})
