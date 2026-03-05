// src/targets/claude-code.ts
import { join } from 'path'
import { homedir } from 'os'
import { BaseTarget } from './base'

export class ClaudeCodeTarget extends BaseTarget {
  name = 'claude-code'

  getGlobalPath(): string {
    return join(homedir(), '.claude', 'commands')
  }

  getProjectPath(projectPath: string): string {
    return join(projectPath, '.claude', 'commands')
  }
}
