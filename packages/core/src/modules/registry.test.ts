import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import type { ExperienceLevel } from './levels'
import {
  findDependencyCycle,
  getModule,
  MODULE_IDS,
  MODULE_REGISTRY,
  type ModuleDefinition,
  type ModuleId,
} from './registry'

function definition(
  id: ModuleId,
  extra: Partial<Pick<ModuleDefinition, 'requires' | 'requiresAnyOf' | 'conflicts'>> = {},
  minLevel: ExperienceLevel = 'basic',
): ModuleDefinition {
  return { id, requires: [], minLevel, ...extra }
}

describe('catálogo de módulos', () => {
  it('tem os 22 ids (15 de antes do ADR-10 e 7 novos), sem duplicata', () => {
    expect(MODULE_IDS).toHaveLength(22)
    expect(new Set(MODULE_IDS).size).toBe(MODULE_IDS.length)
    expect(MODULE_REGISTRY.map((module) => module.id).sort()).toEqual([...MODULE_IDS].sort())
  })

  it('tem exatamente uma definição por id', () => {
    const ids = MODULE_REGISTRY.map((module) => module.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('só o núcleo é core, e ele é do nível básico', () => {
    const coreModules = MODULE_REGISTRY.filter((module) => module.core === true)
    expect(coreModules.map((module) => module.id)).toEqual(['core'])
    expect(getModule('core')).toMatchObject({ requires: [], minLevel: 'basic' })
  })

  it('toda dependência referencia um id existente', () => {
    const known = new Set<string>(MODULE_IDS)
    for (const module of MODULE_REGISTRY) {
      const referenced = [
        ...module.requires,
        ...(module.requiresAnyOf ?? []).flat(),
        ...(module.conflicts ?? []),
      ]
      for (const id of referenced) {
        expect(known.has(id), `${module.id} referencia ${id}`).toBe(true)
      }
    }
  })

  it('conflitos são simétricos e nunca apontam para o próprio módulo', () => {
    for (const module of MODULE_REGISTRY) {
      for (const other of module.conflicts ?? []) {
        expect(other).not.toBe(module.id)
        expect(getModule(other).conflicts ?? []).toContain(module.id)
      }
    }
  })

  it('um módulo não conflita com quem ele mesmo exige', () => {
    for (const module of MODULE_REGISTRY) {
      for (const required of module.requires) {
        expect(module.conflicts ?? []).not.toContain(required)
      }
    }
  })

  it('não tem ciclo de dependências', () => {
    expect(findDependencyCycle(MODULE_REGISTRY)).toBeNull()
  })

  it('mantém as dependências da proposta do PLANO-2.0', () => {
    expect(getModule('sprints').requires).toEqual(['backlog'])
    expect([...getModule('reviewRetro').requires].sort()).toEqual(['agenda', 'sprints'])
    expect(getModule('burndown')).toMatchObject({
      requires: ['sprints'],
      requiresAnyOf: [['estimates.hours'], ['estimates.points']],
      minLevel: 'advanced',
    })
    expect(getModule('estimates.hours').conflicts).toEqual(['estimates.points'])
    expect(getModule('estimates.points')).toMatchObject({
      conflicts: ['estimates.hours'],
      minLevel: 'advanced',
    })
  })

  it('getModule devolve a definição pedida', () => {
    expect(getModule('wip').id).toBe('wip')
  })

  it('getModule recusa um id que não está no catálogo', () => {
    expect(() => getModule('inexistente' as ModuleId)).toThrow(ValidationError)
  })

  it('o catálogo é somente leitura', () => {
    expect(Object.isFrozen(MODULE_REGISTRY)).toBe(true)
    expect(Object.isFrozen(getModule('burndown').requires)).toBe(true)
    expect(Object.isFrozen(getModule('burndown').requiresAnyOf?.[0])).toBe(true)
  })
})

describe('findDependencyCycle', () => {
  it('devolve null para um catálogo sem ciclo', () => {
    const catalog = [
      definition('core'),
      definition('backlog', { requires: ['core'] }),
      definition('sprints', { requires: ['backlog'] }),
    ]
    expect(findDependencyCycle(catalog)).toBeNull()
  })

  it('detecta ciclo entre dois módulos', () => {
    const catalog = [
      definition('backlog', { requires: ['sprints'] }),
      definition('sprints', { requires: ['backlog'] }),
    ]
    const cycle = findDependencyCycle(catalog)
    expect(cycle).not.toBeNull()
    expect(cycle?.[0]).toBe(cycle?.[cycle.length - 1])
    expect(cycle).toEqual(expect.arrayContaining(['backlog', 'sprints']))
  })

  it('detecta ciclo que passa por requiresAnyOf', () => {
    const catalog = [
      definition('core'),
      definition('burndown', { requiresAnyOf: [['estimates.hours']] }),
      definition('estimates.hours', { requires: ['burndown'] }),
    ]
    expect(findDependencyCycle(catalog)).toEqual(
      expect.arrayContaining(['burndown', 'estimates.hours']),
    )
  })

  it('detecta dependência de um módulo para ele mesmo', () => {
    expect(findDependencyCycle([definition('agenda', { requires: ['agenda'] })])).toEqual([
      'agenda',
      'agenda',
    ])
  })

  it('ignora conflitos, que são simétricos por definição', () => {
    const catalog = [
      definition('estimates.hours', { conflicts: ['estimates.points'] }),
      definition('estimates.points', { conflicts: ['estimates.hours'] }),
    ]
    expect(findDependencyCycle(catalog)).toBeNull()
  })

  it('encontra ciclo mesmo quando o início da busca não está nele', () => {
    const catalog = [
      definition('core'),
      definition('agenda', { requires: ['checkins'] }),
      definition('checkins', { requires: ['impediments'] }),
      definition('impediments', { requires: ['checkins'] }),
    ]
    expect(findDependencyCycle(catalog)).toEqual(
      expect.arrayContaining(['checkins', 'impediments']),
    )
  })
})
