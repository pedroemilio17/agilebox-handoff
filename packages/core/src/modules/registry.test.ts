import { describe, expect, it } from 'vitest'
import { EXPERIENCE_LEVELS } from './experience-level'
import { MODULE_REGISTRY, dependenciesOf, findDependencyCycle } from './registry'
import { MODULE_IDS, isModuleId } from './types'
import type { ModuleDefinition, ModuleId } from './types'

describe('registro de módulos', () => {
  it('tem os 15 ids do plano, sem repetição', () => {
    expect(MODULE_IDS).toHaveLength(15)
    expect(new Set(MODULE_IDS).size).toBe(15)
    expect(Object.keys(MODULE_REGISTRY).sort()).toEqual([...MODULE_IDS].sort())
  })

  it('cada definição tem o próprio id e um nível mínimo válido', () => {
    for (const id of MODULE_IDS) {
      const definition = MODULE_REGISTRY[id]
      expect(definition.id).toBe(id)
      expect(EXPERIENCE_LEVELS).toContain(definition.minLevel)
    }
  })

  it('marca só o núcleo como obrigatório, e ele não depende de nada', () => {
    const core = MODULE_IDS.filter((id) => MODULE_REGISTRY[id].core === true)
    expect(core).toEqual(['core'])
    expect(MODULE_REGISTRY.core.requires).toEqual([])
  })

  it('referências existem: requires, requiresAnyOf e conflicts só apontam para ids do catálogo', () => {
    for (const id of MODULE_IDS) {
      const definition = MODULE_REGISTRY[id]
      const references = [
        ...definition.requires,
        ...(definition.requiresAnyOf ?? []).flat(),
        ...(definition.conflicts ?? []),
      ]
      for (const reference of references) {
        expect(isModuleId(reference), `${id} aponta para ${reference}`).toBe(true)
      }
    }
  })

  it('não tem ciclo de dependência', () => {
    expect(findDependencyCycle(MODULE_REGISTRY)).toBeNull()
  })

  it('detecta ciclo quando um módulo passa a depender de quem depende dele', () => {
    const cyclic: Record<ModuleId, ModuleDefinition> = {
      ...MODULE_REGISTRY,
      sprints: { ...MODULE_REGISTRY.sprints, requires: ['burndown'] },
    }
    const cycle = findDependencyCycle(cyclic)
    expect(cycle).not.toBeNull()
    expect(cycle?.[0]).toBe(cycle?.at(-1))
    expect(cycle).toEqual(expect.arrayContaining(['sprints', 'burndown']))
  })

  it('detecta ciclo que passa por requiresAnyOf', () => {
    const cyclic: Record<ModuleId, ModuleDefinition> = {
      ...MODULE_REGISTRY,
      backlog: { ...MODULE_REGISTRY.backlog, requiresAnyOf: [['burndown']] },
    }
    expect(findDependencyCycle(cyclic)).not.toBeNull()
  })

  it('conflitos são simétricos', () => {
    for (const id of MODULE_IDS) {
      for (const other of MODULE_REGISTRY[id].conflicts ?? []) {
        expect(MODULE_REGISTRY[other].conflicts, `${other} deve conflitar com ${id}`).toContain(id)
      }
    }
  })

  it('estimativa em horas e em pontos conflitam entre si', () => {
    expect(MODULE_REGISTRY['estimates.hours'].conflicts).toEqual(['estimates.points'])
    expect(MODULE_REGISTRY['estimates.points'].conflicts).toEqual(['estimates.hours'])
  })

  it('burndown exige sprints e horas OU pontos', () => {
    expect(MODULE_REGISTRY.burndown.requires).toEqual(['sprints'])
    expect(MODULE_REGISTRY.burndown.requiresAnyOf).toEqual([
      ['estimates.hours', 'estimates.points'],
    ])
  })

  it('dependenciesOf inclui requires e todas as alternativas de requiresAnyOf', () => {
    expect(dependenciesOf(MODULE_REGISTRY.burndown)).toEqual([
      'sprints',
      'estimates.hours',
      'estimates.points',
    ])
    expect(dependenciesOf(MODULE_REGISTRY.agenda)).toEqual([])
  })
})
