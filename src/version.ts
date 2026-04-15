import { readFileSync } from 'node:fs'

interface PackageMetadata {
  version?: string
}

export function readPackageVersion(): string {
  const packageJsonUrl = new URL('../package.json', import.meta.url)
  const packageJson = JSON.parse(
    readFileSync(packageJsonUrl, 'utf-8'),
  ) as PackageMetadata

  return packageJson.version ?? '0.0.0'
}

export function formatCliVersion(): string {
  return `ki v${readPackageVersion()}`
}
