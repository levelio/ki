import { describe, expect, it } from 'vitest'
import {
  hasChangesetFile,
  shouldRequireChangeset,
} from '../../scripts/changeset-policy.mjs'

describe('changeset policy', () => {
  it('requires a changeset for product code changes', () => {
    expect(shouldRequireChangeset(['src/cli.ts'])).toBe(true)
    expect(hasChangesetFile(['src/cli.ts'])).toBe(false)
  })

  it('does not require a changeset for docs and ci only changes', () => {
    expect(
      shouldRequireChangeset(['README.md', '.github/workflows/release.yml']),
    ).toBe(false)
  })

  it('does not require a changeset for release pr artifacts', () => {
    expect(
      shouldRequireChangeset([
        'CHANGELOG.md',
        'package.json',
        'package-lock.json',
      ]),
    ).toBe(false)
  })

  it('detects real changeset files', () => {
    expect(hasChangesetFile(['.changeset/fix-bug.md'])).toBe(true)
    expect(hasChangesetFile(['.changeset/README.md'])).toBe(false)
  })
})
