// src/utils/platform.ts
import { platform } from 'os'

export function isWindows(): boolean {
  return platform() === 'win32'
}

export function isMac(): boolean {
  return platform() === 'darwin'
}

export function isLinux(): boolean {
  return platform() === 'linux'
}
