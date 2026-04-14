import * as p from '@clack/prompts'
import type { CliFlags, Config } from '../../types'
import { providerRegistry } from '../../providers'
import {
  filterInstalledRecordsByScope,
  getInstalledRecordsForSkill,
  loadInstalled,
} from '../../installed'
import { printSkillInstallations } from './display'
import { getEnabledSources } from './shared'

async function showSkills(
  config: Pick<Config, 'sources'>,
  flags: CliFlags,
  title: string
) {
  p.intro(title)

  const spinner = p.spinner()
  spinner.start('Loading skills...')

  const skills = await providerRegistry.discoverAll(getEnabledSources(config))
  const currentProjectPath = process.cwd()
  const installed = filterInstalledRecordsByScope(await loadInstalled(), flags, currentProjectPath)

  spinner.stop(`Found ${skills.length} skills`)

  let filtered = skills
  if (flags['installed']) {
    filtered = filtered.filter(s => {
      const record = installed.find(r => r.id === s.id)
      return !!record
    })
  }
  if (flags['source']) {
    filtered = filtered.filter(s => s._source === flags['source'])
  }
  const positionalArgs = flags._ ?? []
  if (positionalArgs.length > 0) {
    const query = positionalArgs[0].toLowerCase()
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query)
    )
  }

  if (filtered.length === 0) {
    p.note('No skills found matching criteria')
    p.outro('Done')
    return
  }

  console.log('')
  for (const skill of filtered) {
    const records = getInstalledRecordsForSkill(installed, skill.id)
    printSkillInstallations(skill.id, records)
  }
  console.log('')
  p.outro(`${filtered.length} skill(s)`)
}

export async function listSkills(config: Pick<Config, 'sources'>, flags: CliFlags) {
  await showSkills(config, flags, 'Skill List')
}

export async function searchSkills(config: Pick<Config, 'sources'>, flags: CliFlags) {
  await showSkills(config, flags, 'Search Skills')
}
