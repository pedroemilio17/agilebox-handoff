import { describe, expect, it } from 'vitest'
import { EXPERIENCE_LEVELS, isExperienceLevel } from './experience-level'

describe('níveis de experiência', () => {
  it('aceita só os três níveis do catálogo', () => {
    for (const level of EXPERIENCE_LEVELS) {
      expect(isExperienceLevel(level)).toBe(true)
    }
  })

  it('recusa valor desconhecido, vazio e de outro tipo', () => {
    expect(isExperienceLevel('expert')).toBe(false)
    expect(isExperienceLevel('')).toBe(false)
    expect(isExperienceLevel('BASIC')).toBe(false)
    expect(isExperienceLevel('constructor')).toBe(false)
    expect(isExperienceLevel(null as unknown as string)).toBe(false)
    expect(isExperienceLevel(undefined as unknown as string)).toBe(false)
  })
})
