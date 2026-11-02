import { describe, expect, it } from 'vitest'
import { EXPERIENCE_LEVELS } from './experience-level'
import type { ExperienceLevel } from './experience-level'
import { TASK_FIELD_IDS, taskFieldLayout } from './task-fields'
import type { TaskFieldId } from './task-fields'
import { MODULE_IDS } from './types'
import type { ModuleId } from './types'

const ALL_ON: readonly ModuleId[] = MODULE_IDS

describe('campos da tarefa por nível', () => {
  it('Essencial mostra título, estado e prazo, e nada recolhido', () => {
    expect(taskFieldLayout('basic', ALL_ON)).toEqual({
      level: 'basic',
      visible: ['title', 'status', 'due'],
      collapsed: [],
    })
  })

  it('Padrão soma responsáveis, estimativa e linha do tempo, com os avançados recolhidos', () => {
    expect(taskFieldLayout('intermediate', ALL_ON)).toEqual({
      level: 'intermediate',
      visible: ['title', 'status', 'due', 'assignees', 'estimate', 'timeline'],
      collapsed: ['hourlyCost', 'dependencies', 'acceptanceCriteria', 'labels'],
    })
  })

  it('Avançado mostra tudo sempre, sem recolhido', () => {
    expect(taskFieldLayout('advanced', ALL_ON)).toEqual({
      level: 'advanced',
      visible: [...TASK_FIELD_IDS],
      collapsed: [],
    })
  })

  it('estimativa some quando estimates.hours está desligado, em qualquer nível', () => {
    const without = MODULE_IDS.filter((id) => id !== 'estimates.hours')
    expect(taskFieldLayout('intermediate', without).visible).not.toContain('estimate')
    expect(taskFieldLayout('advanced', without).visible).not.toContain('estimate')
  })

  it('estimates.points ligado não mostra estimativa (o campo depende de horas)', () => {
    const points: readonly ModuleId[] = ['core', 'estimates.points']
    expect(taskFieldLayout('intermediate', points).visible).not.toContain('estimate')
  })

  it('critérios de aceite somem quando acceptance está desligado, inclusive no Avançado', () => {
    const without = MODULE_IDS.filter((id) => id !== 'acceptance')
    expect(taskFieldLayout('advanced', without).visible).not.toContain('acceptanceCriteria')
    expect(taskFieldLayout('intermediate', without).collapsed).not.toContain('acceptanceCriteria')
  })

  it('campos sem módulo continuam com o módulo desligado', () => {
    const core: readonly ModuleId[] = ['core']
    expect(taskFieldLayout('advanced', core).visible).toEqual(
      TASK_FIELD_IDS.filter((id) => id !== 'estimate' && id !== 'acceptanceCriteria'),
    )
  })

  it('subir de nível só acrescenta campos: nenhum some ao subir', () => {
    const shownAt = (level: ExperienceLevel) => {
      const layout = taskFieldLayout(level, ALL_ON)
      return new Set<TaskFieldId>([...layout.visible, ...layout.collapsed])
    }
    for (let i = 1; i < EXPERIENCE_LEVELS.length; i += 1) {
      const lower = shownAt(EXPERIENCE_LEVELS[i - 1] as ExperienceLevel)
      const higher = shownAt(EXPERIENCE_LEVELS[i] as ExperienceLevel)
      for (const id of lower) expect(higher.has(id)).toBe(true)
    }
  })

  it('a ordem segue o catálogo e não há campo repetido entre visível e recolhido', () => {
    for (const level of EXPERIENCE_LEVELS) {
      const { visible, collapsed } = taskFieldLayout(level, ALL_ON)
      const all = [...visible, ...collapsed]
      expect(new Set(all).size).toBe(all.length)
      expect(all).toEqual(TASK_FIELD_IDS.filter((id) => all.includes(id)))
    }
  })
})
