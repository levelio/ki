import { describe, expect, it } from 'vitest'
import { readCliPackageContract } from '../src/package-contract'

describe('package contract', () => {
  it('exposes the ki binary from the built cli entrypoint', () => {
    const contract = readCliPackageContract()

    expect(contract.bin.ki).toBe('dist/cli.js')
    if (contract.cliExists) {
      expect(contract.hasNodeShebang).toBe(true)
    }
  })
})
