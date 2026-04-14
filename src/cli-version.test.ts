import { describe, expect, it } from 'vitest'
import packageJson from '../package.json'
import { formatCliVersion, readPackageVersion } from './version'

describe('cli version helpers', () => {
  it('reads the version from package.json', () => {
    expect(readPackageVersion()).toBe(packageJson.version)
  })

  it('formats the cli version output with the ki command name', () => {
    expect(formatCliVersion()).toBe(`ki v${packageJson.version}`)
  })
})
