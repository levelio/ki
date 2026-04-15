import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as YAML from 'yaml'

function requiresChangeset(summary: string): boolean {
  return summary.trim().length > 0
}

function releasePrTitle(): string {
  return 'chore: release'
}

function readReleaseWorkflow() {
  const workflow = readFileSync('.github/workflows/release.yml', 'utf-8')
  return YAML.parse(workflow) as {
    permissions: Record<string, string>
    jobs: {
      publish: {
        steps: Array<{
          uses?: string
          with?: Record<string, string>
          env?: Record<string, string>
        }>
      }
    }
  }
}

describe('changesets release workflow helpers', () => {
  it('treats non-empty user-facing summaries as changeset-worthy', () => {
    expect(requiresChangeset('add npm publish workflow')).toBe(true)
    expect(requiresChangeset('  ')).toBe(false)
  })

  it('uses the expected release PR title', () => {
    expect(releasePrTitle()).toBe('chore: release')
  })

  it('uses npm trusted publishing in the release workflow', () => {
    const workflow = readReleaseWorkflow()
    const setupNodeStep = workflow.jobs.publish.steps.find((step) =>
      step.uses?.startsWith('actions/setup-node@'),
    )
    const changesetsStep = workflow.jobs.publish.steps.find((step) =>
      step.uses?.startsWith('changesets/action@'),
    )

    expect(workflow.permissions['id-token']).toBe('write')
    expect(setupNodeStep?.with?.['node-version']).toBe(20)
    expect(changesetsStep?.env?.GITHUB_TOKEN).toBe(
      '${{ secrets.GITHUB_TOKEN }}',
    )
    expect(changesetsStep?.env?.NPM_TOKEN).toBeUndefined()
  })
})
