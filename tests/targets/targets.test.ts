import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, lstatSync } from 'fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ClaudeCodeTarget } from '../../src/targets/claude-code'
import { CodexTarget } from '../../src/targets/codex'
import { CursorTarget } from '../../src/targets/cursor'
import type { SkillContent } from '../../src/types'

const tempDirs: string[] = []

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('target project installs', () => {
  it('ClaudeCodeTarget installs, lists, and uninstalls project skills', async () => {
    const projectDir = await makeTempDir('ki-claude-target-')
    const target = new ClaudeCodeTarget()
    const skill: SkillContent = {
      id: 'source:brainstorming',
      content: '# Brainstorming\n\nGenerate ideas.',
      checksum: 'sha256:1',
    }

    await target.install(skill, { scope: 'project', projectPath: projectDir })

    const skillFile = join(projectDir, '.claude', 'skills', 'brainstorming', 'SKILL.md')
    expect(existsSync(skillFile)).toBe(true)
    const content = await readFile(skillFile, 'utf-8')
    expect(content).toContain('name: brainstorming')
    expect(content).toContain('# Brainstorming')

    const listed = await target.list('project', projectDir)
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe('brainstorming')

    await target.uninstall('source:brainstorming', { scope: 'project', projectPath: projectDir })
    expect(existsSync(join(projectDir, '.claude', 'skills', 'brainstorming'))).toBe(false)
  })

  it('CursorTarget installs via file symlink when sourcePath exists and removes cleanly', async () => {
    const projectDir = await makeTempDir('ki-cursor-target-')
    const sourceDir = await makeTempDir('ki-cursor-source-')
    const sourceFile = join(sourceDir, 'SKILL.md')
    await writeFile(sourceFile, '# Cursor Skill\n\nReusable content.')

    const target = new CursorTarget()
    const skill: SkillContent = {
      id: 'source:cursor-skill',
      content: '# Cursor Skill\n\nReusable content.',
      checksum: 'sha256:2',
      sourcePath: sourceFile,
      sourceDir,
    }

    await target.install(skill, { scope: 'project', projectPath: projectDir })

    const skillFile = join(projectDir, '.cursor', 'skills', 'cursor-skill', 'SKILL.md')
    expect(existsSync(skillFile)).toBe(true)
    expect(lstatSync(skillFile).isSymbolicLink()).toBe(true)

    const listed = await target.list('project', projectDir)
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe('cursor-skill')

    await target.uninstall('source:cursor-skill', { scope: 'project', projectPath: projectDir })
    expect(existsSync(join(projectDir, '.cursor', 'skills', 'cursor-skill'))).toBe(false)
  })

  it('CodexTarget symlinks source directories for project installs', async () => {
    const projectDir = await makeTempDir('ki-codex-target-')
    const sourceDir = await makeTempDir('ki-codex-source-')
    await mkdir(sourceDir, { recursive: true })
    await writeFile(join(sourceDir, 'SKILL.md'), '# Codex Skill\n\nCodex content.')
    await writeFile(join(sourceDir, 'extra.txt'), 'extra asset')

    const target = new CodexTarget()
    const skill: SkillContent = {
      id: 'source:codex-skill',
      content: '# Codex Skill\n\nCodex content.',
      checksum: 'sha256:3',
      sourceDir,
      sourcePath: join(sourceDir, 'SKILL.md'),
    }

    await target.install(skill, { scope: 'project', projectPath: projectDir })

    const skillDir = join(projectDir, '.agents', 'skills', 'codex-skill')
    expect(existsSync(join(skillDir, 'SKILL.md'))).toBe(true)
    expect(existsSync(join(skillDir, 'extra.txt'))).toBe(true)
    expect(lstatSync(skillDir).isSymbolicLink()).toBe(true)

    const listed = await target.list('project', projectDir)
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe('codex-skill')

    await target.uninstall('source:codex-skill', { scope: 'project', projectPath: projectDir })
    expect(existsSync(skillDir)).toBe(false)
  })
})
