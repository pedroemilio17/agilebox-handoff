import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppearancePreference } from './windows/glass'

const FILE = 'appearance.json'

export function parseAppearance(text: string): AppearancePreference | undefined {
  try {
    const mode: unknown = (JSON.parse(text) as { mode?: unknown }).mode
    return mode === 'opaque' || mode === 'translucent' ? mode : undefined
  } catch {
    return undefined
  }
}

/** Preferência de fundo salva em Ajustes, lida antes de criar as janelas. */
export function readAppearance(userDataPath: string): AppearancePreference | undefined {
  try {
    return parseAppearance(readFileSync(join(userDataPath, FILE), 'utf8'))
  } catch {
    return undefined
  }
}

export function writeAppearance(userDataPath: string, mode: AppearancePreference): void {
  mkdirSync(userDataPath, { recursive: true })
  writeFileSync(join(userDataPath, FILE), JSON.stringify({ mode }))
}
