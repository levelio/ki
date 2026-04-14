import { afterEach, describe, expect, it, mock } from 'bun:test'
import { ProviderRegistry } from '../../src/providers/registry'
import type { Provider, SkillMeta, SourceConfig } from '../../src/types'

const originalWarn = console.warn
const originalError = console.error

function createSource(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return {
    name: 'source',
    provider: 'mock',
    url: 'https://github.com/acme/skills.git',
    enabled: true,
    ...overrides,
  }
}

function createProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    name: 'mock',
    discover: async () => [],
    fetchSkillContent: async skill => ({
      id: skill.id,
      content: '# Skill',
      checksum: 'sha256:1',
    }),
    ...overrides,
  }
}

afterEach(() => {
  console.warn = originalWarn
  console.error = originalError
})

describe('ProviderRegistry', () => {
  it('discoverAll returns skills from enabled registered providers only', async () => {
    const registry = new ProviderRegistry()
    const warn = mock(() => {})
    console.warn = warn as typeof console.warn
    const discover = mock(async (config: SourceConfig): Promise<SkillMeta[]> => [
      {
        id: `${config.name}:alpha`,
        name: 'Alpha',
        _source: config.name,
        _path: `/tmp/${config.name}/SKILL.md`,
      },
    ])

    registry.register(createProvider({ discover }))

    const skills = await registry.discoverAll([
      createSource({ name: 'enabled', enabled: true }),
      createSource({ name: 'disabled', enabled: false }),
      createSource({ name: 'missing', provider: 'missing', enabled: true }),
    ])

    expect(discover).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('Provider not found: missing')
    expect(skills).toEqual([
      {
        id: 'enabled:alpha',
        name: 'Alpha',
        _source: 'enabled',
        _path: '/tmp/enabled/SKILL.md',
      },
    ])
  })

  it('discoverAll warns for missing providers and continues after provider failures', async () => {
    const registry = new ProviderRegistry()
    const warn = mock(() => {})
    const error = mock(() => {})
    console.warn = warn as typeof console.warn
    console.error = error as typeof console.error

    registry.register(createProvider({
      name: 'boom',
      discover: async () => {
        throw new Error('broken')
      },
    }))
    registry.register(createProvider({
      name: 'ok',
      discover: async config => [
        {
          id: `${config.name}:beta`,
          name: 'Beta',
          _source: config.name,
          _path: '/tmp/beta/SKILL.md',
        },
      ],
    }))

    const skills = await registry.discoverAll([
      createSource({ name: 'missing', provider: 'missing' }),
      createSource({ name: 'broken', provider: 'boom' }),
      createSource({ name: 'healthy', provider: 'ok' }),
    ])

    expect(warn).toHaveBeenCalledWith('Provider not found: missing')
    expect(error).toHaveBeenCalledWith('Failed to discover skills from broken:', expect.any(Error))
    expect(skills.map(skill => skill.id)).toEqual(['healthy:beta'])
  })

  it('fetchContent uses the matching provider and throws for missing providers', async () => {
    const registry = new ProviderRegistry()
    const fetchSkillContent = mock(async (skill: SkillMeta) => ({
      id: skill.id,
      content: `# ${skill.name}`,
      checksum: 'sha256:2',
    }))

    registry.register(createProvider({ fetchSkillContent }))

    const skill = {
      id: 'source:alpha',
      name: 'Alpha',
      _source: 'source',
      _path: '/tmp/alpha/SKILL.md',
    }

    await expect(
      registry.fetchContent(skill, createSource({ provider: 'mock' }))
    ).resolves.toEqual({
      id: 'source:alpha',
      content: '# Alpha',
      checksum: 'sha256:2',
    })

    await expect(
      registry.fetchContent(skill, createSource({ provider: 'missing' }))
    ).rejects.toThrow('Provider not found: missing')
  })

  it('sync calls provider sync only when supported', async () => {
    const registry = new ProviderRegistry()
    const sync = mock(async () => {})

    registry.register(createProvider({ name: 'syncable', sync }))
    registry.register(createProvider({ name: 'read-only' }))

    await registry.sync(createSource({ provider: 'syncable' }))
    await registry.sync(createSource({ provider: 'read-only' }))
    await registry.sync(createSource({ provider: 'missing' }))

    expect(sync).toHaveBeenCalledTimes(1)
    expect(sync).toHaveBeenCalledWith(createSource({ provider: 'syncable' }))
  })
})
