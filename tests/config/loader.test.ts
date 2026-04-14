import { describe, expect, it } from 'bun:test'
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
        'name'
      )
    ).toEqual([
      { name: 'codex', enabled: false },
      { name: 'cursor', enabled: true },
    ])
  })

  it('mergeConfig preserves defaults while applying user overrides', () => {
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

    expect(merged.sources.find(source => source.name === 'superpowers')).toMatchObject({
      name: 'superpowers',
      provider: 'git',
      url: 'https://github.com/obra/superpowers.git',
      enabled: false,
    })
    expect(merged.sources.find(source => source.name === 'custom')).toEqual({
      name: 'custom',
      provider: 'git',
      url: 'https://github.com/acme/custom.git',
      enabled: true,
    })
    expect(merged.targets.find(target => target.name === 'codex')).toEqual({
      name: 'codex',
      enabled: false,
    })
    expect(merged.targets.find(target => target.name === 'custom-target')).toEqual({
      name: 'custom-target',
      enabled: true,
    })
    expect(merged.targets.find(target => target.name === 'claude-code')).toEqual({
      name: 'claude-code',
      enabled: true,
    })
  })
})
