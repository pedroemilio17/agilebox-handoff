import { describe, expect, it } from 'vitest'
import { EXPERIENCE_LEVELS } from './experience-level'
import {
  LEVEL_LABELS,
  MODULE_LABELS,
  PRESET_LABELS,
  SUGGESTED_LEVEL,
  TEAM_SCOPE_NOTICE,
} from './labels'
import { PRESET_IDS } from './presets'
import { MODULE_IDS } from './types'

describe('rótulos de ferramentas, níveis e presets', () => {
  it('todo ModuleId tem rótulo não vazio, e não sobra rótulo de id desconhecido', () => {
    expect(Object.keys(MODULE_LABELS).sort()).toEqual([...MODULE_IDS].sort())
    for (const id of MODULE_IDS) {
      expect(MODULE_LABELS[id].trim()).not.toBe('')
    }
  })

  it('rótulos de ferramenta não se repetem', () => {
    const names = Object.values(MODULE_LABELS)
    expect(new Set(names).size).toBe(names.length)
  })

  it('há um rótulo de nome e descrição para cada nível, e o sugerido é um nível existente', () => {
    expect(Object.keys(LEVEL_LABELS).sort()).toEqual([...EXPERIENCE_LEVELS].sort())
    expect(LEVEL_LABELS.basic.name).toBe('Essencial')
    expect(LEVEL_LABELS.intermediate.name).toBe('Padrão')
    expect(LEVEL_LABELS.advanced.name).toBe('Avançado')
    expect(EXPERIENCE_LEVELS).toContain(SUGGESTED_LEVEL)
    expect(SUGGESTED_LEVEL).toBe('intermediate')
    for (const level of EXPERIENCE_LEVELS) {
      expect(LEVEL_LABELS[level].description.trim()).not.toBe('')
    }
  })

  it('nomes de nível não se repetem', () => {
    const names = EXPERIENCE_LEVELS.map((level) => LEVEL_LABELS[level].name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('cada preset tem nome e descrição, e nomes não se repetem', () => {
    expect(Object.keys(PRESET_LABELS).sort()).toEqual([...PRESET_IDS].sort())
    const names = PRESET_IDS.map((id) => PRESET_LABELS[id].name)
    expect(names).toEqual(['Quadro simples', 'Scrum do time', 'Completo'])
    expect(new Set(names).size).toBe(names.length)
    for (const id of PRESET_IDS) {
      expect(PRESET_LABELS[id].description.trim()).not.toBe('')
    }
  })

  it('o aviso de nível fala de time e não de projeto', () => {
    expect(TEAM_SCOPE_NOTICE).toBe('Vale para o time inteiro. Os outros times não mudam.')
    expect(TEAM_SCOPE_NOTICE.toLowerCase()).toContain('time')
    expect(TEAM_SCOPE_NOTICE.toLowerCase()).not.toContain('projeto')
  })
})
