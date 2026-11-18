import { describe, expect, it } from 'vitest'
import { getManifest } from './manifest'
import {
  getProjectPreset,
  PROJECT_PRESET_KEYS,
  PROJECT_PRESETS,
  projectPresetModules,
} from './project-presets'
import { MODULE_IDS } from './registry'
import { resolveModuleSet } from './resolve'

describe('presets de projeto (ADR-10)', () => {
  it('tem os 5 presets, em ordem, sem chave repetida', () => {
    expect(PROJECT_PRESETS.map((p) => p.key)).toEqual([...PROJECT_PRESET_KEYS])
    expect(PROJECT_PRESET_KEYS).toEqual(['simples', 'kanban', 'agil', 'tradicional', 'hibrido'])
  })

  it('Simples liga só o núcleo; com equipe experiente, acrescenta a atualização diária', () => {
    expect(projectPresetModules('simples', { experienced: false })).toEqual(['core'])
    expect(projectPresetModules('simples', { experienced: true })).toEqual(['core', 'checkins'])
  })

  it('cada preset usa só ids do catálogo e módulos base de nível 1 ou 2', () => {
    for (const preset of PROJECT_PRESETS) {
      for (const id of [...preset.modules, ...preset.experiencedExtras]) {
        expect(MODULE_IDS).toContain(id)
      }
      for (const id of preset.modules) {
        expect(getManifest(id).level, `${preset.key}: ${id}`).not.toBe(3)
      }
    }
  })

  it.each(PROJECT_PRESETS.map((p) => [p.key] as const))(
    '%s resolve num conjunto fechado, com e sem equipe experiente',
    (key) => {
      for (const experienced of [false, true]) {
        const modules = projectPresetModules(key, { experienced })
        expect(modules).toContain('core')
        const again = resolveModuleSet([], { enable: modules })
        expect(again.ok && again.autoEnabled).toEqual([])
      }
    },
  )

  it('Ágil: backlog, estimativa, sprints, cerimônias e atualização diária', () => {
    const modules = projectPresetModules('agil', { experienced: false })
    for (const id of [
      'backlog',
      'estimates.hours',
      'sprints',
      'reviewRetro',
      'checkins',
    ] as const) {
      expect(modules).toContain(id)
    }
    expect(modules).not.toContain('burndown')
    expect(projectPresetModules('agil', { experienced: true })).toEqual(
      expect.arrayContaining(['definitionOfDone', 'burndown']),
    )
  })

  it('Tradicional: nível 3 (custo, linha de base, riscos) só com equipe experiente', () => {
    const base = projectPresetModules('tradicional', { experienced: false })
    expect(base).toEqual(
      expect.arrayContaining(['wbs', 'milestones', 'schedule', 'estimates.hours']),
    )
    for (const id of ['baseline', 'risks'] as const) expect(base).not.toContain(id)
    expect(projectPresetModules('tradicional', { experienced: true })).toEqual(
      expect.arrayContaining(['cost', 'baseline', 'risks']),
    )
  })

  it('Kanban e Híbrido seguem a tabela do ADR', () => {
    expect(projectPresetModules('kanban', { experienced: false })).toEqual(
      expect.arrayContaining(['wip', 'definitionOfDone', 'checkins']),
    )
    expect(getProjectPreset('hibrido').experiencedExtras).toEqual(['schedule', 'burndown'])
    expect(projectPresetModules('hibrido', { experienced: false })).toEqual(
      expect.arrayContaining(['wbs', 'milestones', 'backlog', 'estimates.hours', 'sprints']),
    )
  })
})
