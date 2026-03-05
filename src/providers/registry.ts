// src/providers/registry.ts
import type { Provider, SourceConfig, SkillMeta, SkillContent } from '@/types'
import { LocalProvider } from './local'
import { GitProvider } from './git'

class ProviderRegistry {
  private providers: Map<string, Provider> = new Map()

  constructor() {
    // Register built-in providers
    this.register(new LocalProvider())
    this.register(new GitProvider())
  }

  register(provider: Provider): void {
    this.providers.set(provider.name, provider)
  }

  get(name: string): Provider | undefined {
    return this.providers.get(name)
  }

  has(name: string): boolean {
    return this.providers.has(name)
  }

  async discoverAll(configs: SourceConfig[]): Promise<SkillMeta[]> {
    const allSkills: SkillMeta[] = []

    for (const config of configs) {
      if (!config.enabled) continue

      const provider = this.get(config.provider)
      if (!provider) {
        console.warn(`Provider not found: ${config.provider}`)
        continue
      }

      try {
        const skills = await provider.discover(config)
        allSkills.push(...skills)
      } catch (error) {
        console.error(`Failed to discover skills from ${config.name}:`, error)
      }
    }

    return allSkills
  }

  async fetchContent(skill: SkillMeta, config: SourceConfig): Promise<SkillContent> {
    const provider = this.get(config.provider)
    if (!provider) {
      throw new Error(`Provider not found: ${config.provider}`)
    }

    return provider.fetchSkillContent(skill)
  }
}

export const providerRegistry = new ProviderRegistry()
