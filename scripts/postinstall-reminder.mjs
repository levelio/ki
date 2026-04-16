import { pathToFileURL } from 'node:url'

export function shouldShowGlobalInstallReminder(env = process.env) {
  if (env.npm_config_global === 'true') {
    return true
  }

  if (env.npm_config_location === 'global') {
    return true
  }

  return false
}

export function buildGlobalInstallReminderMessage() {
  return [
    'ki installed successfully.',
    '',
    'Recommended next steps:',
    '  ki init',
    '  ki source sync ki',
    '',
    'Run `ki source sync ki` to refresh the built-in ki source.',
  ].join('\n')
}

export function runPostinstallReminder({
  env = process.env,
  log = console.log,
} = {}) {
  try {
    if (!shouldShowGlobalInstallReminder(env)) {
      return false
    }

    log(buildGlobalInstallReminderMessage())
    return true
  } catch {
    return false
  }
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  runPostinstallReminder()
}
