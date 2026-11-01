import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseAppearance, readAppearance, writeAppearance } from './appearance'

describe('preferência de aparência', () => {
  it('aceita só "opaque" e "translucent"', () => {
    expect(parseAppearance('{"mode":"opaque"}')).toBe('opaque')
    expect(parseAppearance('{"mode":"translucent"}')).toBe('translucent')
    expect(parseAppearance('{"mode":"neon"}')).toBeUndefined()
    expect(parseAppearance('isto não é json')).toBeUndefined()
  })

  it('grava e lê da pasta de dados; sem arquivo não há preferência', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agilebox-'))
    expect(readAppearance(dir)).toBeUndefined()
    writeAppearance(dir, 'opaque')
    expect(readAppearance(dir)).toBe('opaque')
  })
})
