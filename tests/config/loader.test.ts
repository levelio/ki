import { describe, expect, it } from 'vitest'
import { mergeArrays, mergeConfig } from '../../src/config/loader'
import { DEFAULT_CONFIG } from '../../src/types'

describe('config loader helpers', () => {
  it('mergeArrays updates matching entries, appends new entries, and ignores entries without a name', () => {
    expect(
      mergeArrays(
        [{ name: 'codex', enabled: true }],
        [
          { name: 'codex', enabled: false },
          { name: 'cursor', enabled: true },
          { enabled: true },
        ],
        'name',
      ),
    ).toEqual([
      { name: 'codex', enabled: false },
      { name: 'cursor', enabled: true },
    ])
  })

  it('mergeConfig merges matching defaults but treats explicit sections as authoritative', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, {
      sources: [
        { name: 'superpowers', enabled: false },
        {
          name: 'custom',
          provider: 'git',
          url: 'https://github.com/acme/custom.git',
          enabled: true,
        },
      ],
      targets: [
        { name: 'codex', enabled: false },
        { name: 'custom-target', enabled: true },
      ],
    })

    expect(
      merged.sources.find((source) => source.name === 'superpowers'),
    ).toMatchObject({
      name: 'superpowers',
      provider: 'git',
      url: 'https://github.com/obra/superpowers.git',
      enabled: false,
    })
    expect(merged.sources.find((source) => source.name === 'custom')).toEqual({
      name: 'custom',
      provider: 'git',
      url: 'https://github.com/acme/custom.git',
      enabled: true,
    })
    expect(merged.targets.find((target) => target.name === 'codex')).toEqual({
      name: 'codex',
      enabled: false,
    })
    expect(
      merged.targets.find((target) => target.name === 'custom-target'),
    ).toEqual({
      name: 'custom-target',
      enabled: true,
    })
    expect(
      merged.targets.find((target) => target.name === 'claude-code'),
    ).toBeUndefined()
    expect(
      merged.sources.find((source) => source.name === 'ki'),
    ).toBeUndefined()
  })

  it('mergeConfig does not re-add removed default entries when the section is explicitly present', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, {
      sources: [
        {
          name: 'ki',
          provider: 'git',
          url: 'https://github.com/levelio/ki.git',
          enabled: true,
        },
      ],
      targets: [
        { name: 'codex', enabled: true },
        { name: 'cursor', enabled: true },
      ],
    })

    expect(merged.sources.map((source) => source.name)).toEqual(['ki'])
    expect(merged.targets.map((target) => target.name)).toEqual([
      'codex',
      'cursor',
    ])
    expect(
      merged.sources.find((source) => source.name === 'superpowers'),
    ).toBeUndefined()
    expect(
      merged.targets.find((target) => target.name === 'claude-code'),
    ).toBeUndefined()
  })

  it('mergeConfig falls back to defaults for omitted sections', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, {
      sources: [
        {
          name: 'ki',
          provider: 'git',
          url: 'https://github.com/levelio/ki.git',
          enabled: false,
        },
      ],
    })

    expect(merged.sources).toHaveLength(1)
    expect(merged.sources[0]).toMatchObject({
      name: 'ki',
      enabled: false,
    })
    expect(merged.targets).toEqual(DEFAULT_CONFIG.targets)
  })
})
