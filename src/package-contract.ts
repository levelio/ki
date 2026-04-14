import { existsSync, readFileSync } from 'node:fs'

interface PackageMetadata {
  bin?: Record<string, string>
}

export interface CliPackageContract {
  bin: Record<string, string>
  cliExists: boolean
  hasNodeShebang: boolean
}

export function readCliPackageContract(): CliPackageContract {
  const packageJsonUrl = new URL('../package.json', import.meta.url)
  const cliEntrypointUrl = new URL('../dist/cli.js', import.meta.url)
  const packageJson = JSON.parse(
    readFileSync(packageJsonUrl, 'utf-8'),
  ) as PackageMetadata
  const cliExists = existsSync(cliEntrypointUrl)
  const cliContents = cliExists ? readFileSync(cliEntrypointUrl, 'utf-8') : ''

  return {
    bin: packageJson.bin ?? {},
    cliExists,
    hasNodeShebang: cliContents.startsWith('#!/usr/bin/env node'),
  }
}
