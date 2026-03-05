// src/targets/cursor.ts
import { join } from 'path'
import { BaseTarget } from './base'

export class CursorTarget extends BaseTarget {
  name = 'cursor'

  getGlobalPath(): string {
    // Cursor only supports project-level rules
    throw new Error('Cursor only supports project-level skill installation')
  }

  getProjectPath(projectPath: string): string {
    return join(projectPath, '.cursor', 'rules')
  }
}
