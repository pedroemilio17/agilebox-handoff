import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { EXPERIENCE_LEVELS, isAtLeastLevel } from './experience-level'
import { effectiveCapabilities } from './capabilities'
import type { ModuleId } from './types'

const SCRUM: readonly ModuleId[] = [
  'core',
  'agenda',
  'backlog',
  'sprints',
  'checkins',
  'impediments',
  'estimates.hours',
  'acceptance',
]

describe('nível de experiência', () => {
  it('compara na ordem basic < intermediate < advanced', () => {
    expect(EXPERIENCE_LEVELS).toEqual(['basic', 'intermediate', 'advanced'])
    expect(isAtLeastLevel('basic', 'basic')).toBe(true)
    expect(isAtLeastLevel('basic', 'intermediate')).toBe(false)
    expect(isAtLeastLevel('intermediate', 'basic')).toBe(true)
    expect(isAtLeastLevel('advanced', 'intermediate')).toBe(true)
    expect(isAtLeastLevel('intermediate', 'advanced')).toBe(false)
  })
})

describe('effectiveCapabilities', () => {
  it('módulo desativado some em qualquer nível', () => {
    for (const level of EXPERIENCE_LEVELS) {
      const result = effectiveCapabilities({ modules: ['core'], level, role: 'manager' })
      expect(result.modules, level).not.toContain('agenda')
      expect(result.screens, level).not.toContain('agenda')
    }
  })

  it('nível alto não ativa nada', () => {
    const result = effectiveCapabilities({ modules: [], level: 'advanced', role: 'manager' })
    expect(result.modules).toEqual([])
    expect(result.screens).toEqual([])
  })

  it('efeito passivo fica visível no nível básico, sem a tela', () => {
    const basic = effectiveCapabilities({ modules: SCRUM, level: 'basic', role: 'collaborator' })
    expect(basic.modules).toContain('sprints')
    expect(basic.screens).not.toContain('sprints')
    expect(basic.screens).toContain('agenda')
  })

  it('mostra as telas do módulo a partir do nível mínimo dele', () => {
    const intermediate = effectiveCapabilities({
      modules: SCRUM,
      level: 'intermediate',
      role: 'collaborator',
    })
    expect(intermediate.screens).toEqual(SCRUM)

    const advanced = effectiveCapabilities({
      modules: ['core', 'wip', 'burndown'],
      level: 'intermediate',
      role: 'collaborator',
    })
    expect(advanced.modules).toEqual(['core', 'wip', 'burndown'])
    expect(advanced.screens).toEqual(['core'])
  })

  it('devolve módulos na ordem do catálogo, sem repetir', () => {
    const result = effectiveCapabilities({
      modules: ['sprints', 'core', 'backlog', 'core'],
      level: 'intermediate',
      role: 'manager',
    })
    expect(result.modules).toEqual(['core', 'backlog', 'sprints'])
  })

  it('devolve o nível e o papel recebidos, sem alterar os módulos', () => {
    const asCollaborator = effectiveCapabilities({
      modules: SCRUM,
      level: 'basic',
      role: 'collaborator',
    })
    const asManager = effectiveCapabilities({ modules: SCRUM, level: 'basic', role: 'manager' })
    expect(asCollaborator.role).toBe('collaborator')
    expect(asManager.role).toBe('manager')
    expect(asManager.modules).toEqual(asCollaborator.modules)
    expect(asManager.screens).toEqual(asCollaborator.screens)
  })

  it('recusa id de módulo desconhecido', () => {
    expect(() =>
      effectiveCapabilities({
        modules: ['core', 'inexistente' as ModuleId],
        level: 'basic',
        role: 'manager',
      }),
    ).toThrow(ValidationError)
  })
})
