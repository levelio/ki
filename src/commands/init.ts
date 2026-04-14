import * as p from '@clack/prompts'
import { saveConfig } from '../config'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { DEFAULT_CONFIG } from '../types'

export async function initConfig() {
  p.intro('Initialize Config')

  const configPath = join(homedir(), '.config', 'ki', 'config.yaml')

  if (existsSync(configPath)) {
    const overwrite = await p.confirm({
      message: 'Config file already exists. Overwrite?',
      initialValue: false
    })

    if (!overwrite || p.isCancel(overwrite)) {
      p.outro('Cancelled')
      return
    }
  }

  const spinner = p.spinner()
  spinner.start('Creating config file...')

  await saveConfig(DEFAULT_CONFIG)

  spinner.stop('Done')
  p.outro(`Config file created at ${configPath}`)
}
