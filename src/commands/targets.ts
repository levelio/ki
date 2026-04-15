import * as p from '@clack/prompts'
import { targetRegistry } from '../targets'
import type { Config } from '../types'

export async function targetList(config: Pick<Config, 'targets'>) {
  p.intro('Targets')

  for (const targetConfig of config.targets) {
    const icon = targetConfig.enabled ? '◉' : '◯'
    const target = targetRegistry.get(targetConfig.name)

    console.log(`  ${icon} ${targetConfig.name}`)
    if (target) {
      try {
        console.log(`     Global: ${target.getGlobalPath()}`)
      } catch {
        console.log('     Global: (not supported)')
      }
      console.log(`     Project: ${target.getProjectPath('.')}`)
    }
    console.log('')
  }

  p.outro(`${config.targets.length} target(s)`)
}
