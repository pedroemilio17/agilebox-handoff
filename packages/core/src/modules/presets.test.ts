import { describe, expect, it } from 'vitest'
import { isLevelAtLeast } from './levels'
import { getModule, MODULE_IDS } from './registry'
import type { ModuleId } from './registry'
import { TEAM_PRESETS } from './presets'

function isSatisfied(id: ModuleId, modules: readonly ModuleId[]): boolean {
  const definition = getModule(id)
  const requiredOk = definition.requires.every((required) => modules.includes(required))
  const alternatives = definition.requiresAnyOf ?? []
  const anyOfOk =
    alternatives.length === 0 ||
    alternatives.some((alternative) => alternative.every((option) => modules.includes(option)))
  return requiredOk && anyOfOk
}

describe('presets de equipe', () => {
  it('tem os 4 presets do plano, com rótulos e ids únicos', () => {
    expect(TEAM_PRESETS.map((preset) => preset.label)).toEqual([
      'Kanban simples',
      'Scrum',
      'Kanban com fluxo',
      'Scrum completo',
    ])
    expect(new Set(TEAM_PRESETS.map((preset) => preset.id)).size).toBe(TEAM_PRESETS.length)
  })

  it.each(TEAM_PRESETS.map((preset) => [preset.id, preset] as const))(
    '%s é um conjunto fechado: toda dependência de cada módulo está no preset',
    (_id, preset) => {
      for (const id of preset.modules) {
        expect(isSatisfied(id, preset.modules), `${id} sem dependências`).toBe(true)
      }
    },
  )

  it.each(TEAM_PRESETS.map((preset) => [preset.id, preset] as const))(
    '%s não tem módulos em conflito',
    (_id, preset) => {
      for (const id of preset.modules) {
        for (const conflict of getModule(id).conflicts ?? []) {
          expect(preset.modules, `${id} conflita com ${conflict}`).not.toContain(conflict)
        }
      }
    },
  )

  it.each(TEAM_PRESETS.map((preset) => [preset.id, preset] as const))(
    '%s inclui o núcleo e não repete módulos',
    (_id, preset) => {
      expect(preset.modules).toContain('core')
      expect(new Set(preset.modules).size).toBe(preset.modules.length)
    },
  )

  it.each(TEAM_PRESETS.map((preset) => [preset.id, preset] as const))(
    '%s usa só ids do catálogo',
    (_id, preset) => {
      for (const id of preset.modules) {
        expect(MODULE_IDS).toContain(id)
      }
    },
  )

  it.each(TEAM_PRESETS.map((preset) => [preset.id, preset] as const))(
    '%s tem nível sugerido que alcança o mínimo de cada módulo',
    (_id, preset) => {
      for (const id of preset.modules) {
        expect(isLevelAtLeast(preset.suggestedLevel, getModule(id).minLevel), id).toBe(true)
      }
    },
  )

  it('os níveis sugeridos seguem o plano', () => {
    expect(Object.fromEntries(TEAM_PRESETS.map((p) => [p.id, p.suggestedLevel]))).toEqual({
      kanban: 'basic',
      scrum: 'intermediate',
      'kanban-flow': 'advanced',
      'scrum-complete': 'advanced',
    })
  })
})
