import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as YAML from 'yaml'

function readChangesetCheckWorkflow() {
  const workflow = readFileSync(
    '.github/workflows/changeset-check.yml',
    'utf-8',
  )
  return YAML.parse(workflow) as {
    jobs: {
      changeset: {
        steps: Array<{
          uses?: string
          with?: Record<string, string | number>
          run?: string
        }>
      }
    }
  }
}

describe('changeset check workflow', () => {
  it('validates the repository on Node 20 before enforcing changesets', () => {
    const workflow = readChangesetCheckWorkflow()
    const steps = workflow.jobs.changeset.steps
    const setupNodeStep = steps.find((step) =>
      step.uses?.startsWith('actions/setup-node@'),
    )
    const runCommands = steps.flatMap((step) => (step.run ? [step.run] : []))

    expect(setupNodeStep?.with?.['node-version']).toBe(20)
    expect(runCommands).toContain('npm ci')
    expect(runCommands).toContain('npm run check')
    expect(runCommands).toContain('npm test')
    expect(runCommands).toContain('npm run build')
  })
})
