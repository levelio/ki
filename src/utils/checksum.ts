// src/utils/checksum.ts
import { createHash } from 'node:crypto'

export function computeChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export function computeFileChecksum(content: string): string {
  return `sha256:${computeChecksum(content)}`
}
