import { describe, expect, it } from 'vitest'
import { getNativeRebuildPlan } from './native-rebuild-plan.mjs'

describe('plano de reconstrução do better-sqlite3', () => {
  it('usa npm rebuild para o alvo Node dos testes', () => {
    expect(getNativeRebuildPlan('node')).toEqual({
      command: 'npm',
      args: ['rebuild', 'better-sqlite3'],
    })
  })

  it('usa @electron/rebuild para o alvo Electron do aplicativo', () => {
    expect(getNativeRebuildPlan('electron')).toEqual({
      command: 'pnpm',
      args: ['exec', 'electron-rebuild', '-f', '-w', 'better-sqlite3'],
    })
  })
})
