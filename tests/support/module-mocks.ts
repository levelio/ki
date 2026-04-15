import { existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { vi } from 'vitest'

const mockedModules = new Set<string>()

function getCallerFile(): string | null {
  const stack = new Error().stack?.split('\n') ?? []

  for (const line of stack) {
    if (
      line.includes('/tests/support/module-mocks.ts') ||
      line.includes('\\tests\\support\\module-mocks.ts')
    ) {
      continue
    }

    const match =
      line.match(/\((file:\/\/.+?):\d+:\d+\)/) ??
      line.match(/at (file:\/\/.+?):\d+:\d+/) ??
      line.match(/\((\/.+?):\d+:\d+\)/) ??
      line.match(/at (\/.+?):\d+:\d+/)

    if (!match) {
      continue
    }

    return match[1].startsWith('file://')
      ? new URL(match[1]).pathname
      : match[1]
  }

  return null
}

function resolveExistingModulePath(candidate: string): string {
  const directoryCandidates = [
    resolve(candidate, 'index.ts'),
    resolve(candidate, 'index.js'),
    resolve(candidate, 'index.mts'),
    resolve(candidate, 'index.mjs'),
  ]
  const candidates = [
    `${candidate}.ts`,
    `${candidate}.js`,
    `${candidate}.mts`,
    `${candidate}.mjs`,
    ...directoryCandidates,
    candidate,
  ]

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate
  }

  return candidates.find((value) => existsSync(value)) ?? candidate
}

function normalizeModuleId(moduleId: string): string {
  if (!moduleId.startsWith('.')) {
    return moduleId
  }

  const callerFile = getCallerFile()
  if (!callerFile) {
    return moduleId
  }

  return resolveExistingModulePath(resolve(dirname(callerFile), moduleId))
}

export function mockModule(
  moduleId: string,
  factory: Parameters<typeof vi.doMock>[1],
): void {
  const normalizedModuleId = normalizeModuleId(moduleId)
  const moduleIds = new Set([
    moduleId,
    normalizedModuleId,
    pathToFileURL(normalizedModuleId).href,
  ])

  for (const value of moduleIds) {
    mockedModules.add(value)
    vi.doMock(value, factory)
  }
}

export function resetModuleMocks(): void {
  vi.restoreAllMocks()
  vi.clearAllMocks()

  for (const moduleId of mockedModules) {
    vi.doUnmock(moduleId)
  }

  mockedModules.clear()
  vi.resetModules()
}
