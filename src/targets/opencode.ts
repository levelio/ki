// src/targets/opencode.ts
import { join } from 'path'
import { homedir } from 'os'
import { BaseTarget } from './base'

export class OpenCodeTarget extends BaseTarget {
  name = 'opencode'

  getGlobalPath(): string {
    return join(homedir(), '.config', 'opencode', 'commands')
  }

  getProjectPath(projectPath: string): string {
    return join(projectPath, '.opencode', 'commands')
  }
}
