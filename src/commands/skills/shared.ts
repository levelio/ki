import type { Config, SourceConfig, SkillMeta } from '../../types'

export function getEnabledSources(config: Pick<Config, 'sources'>): SourceConfig[] {
  return config.sources.filter(source => source.enabled)
}

export function findSkillSourceConfig(
  config: Pick<Config, 'sources'>,
  skill: Pick<SkillMeta, '_source'>
): SourceConfig | undefined {
  return config.sources.find(source => source.name === skill._source)
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
