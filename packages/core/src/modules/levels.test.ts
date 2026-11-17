import { describe, expect, it } from 'vitest'
import { EXPERIENCE_LEVELS, EXPERIENCE_LEVEL_LABELS, isLevelAtLeast } from './levels'

describe('níveis de proficiência', () => {
  it('lista os níveis do mais simples ao mais avançado', () => {
    expect(EXPERIENCE_LEVELS).toEqual(['basic', 'intermediate', 'advanced'])
  })

  it('tem rótulos em português para cada nível', () => {
    expect(EXPERIENCE_LEVEL_LABELS).toEqual({
      basic: 'Básico',
      intermediate: 'Intermediário',
      advanced: 'Avançado',
    })
  })

  it.each([
    ['basic', 'basic', true],
    ['basic', 'intermediate', false],
    ['basic', 'advanced', false],
    ['intermediate', 'basic', true],
    ['intermediate', 'intermediate', true],
    ['intermediate', 'advanced', false],
    ['advanced', 'basic', true],
    ['advanced', 'intermediate', true],
    ['advanced', 'advanced', true],
  ] as const)('isLevelAtLeast(%s, %s) é %s', (level, minLevel, expected) => {
    expect(isLevelAtLeast(level, minLevel)).toBe(expected)
  })
})
