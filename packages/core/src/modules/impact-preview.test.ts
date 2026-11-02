import { describe, expect, it } from 'vitest'
import { dependentsOf, previewModuleImpact } from './impact-preview'
import type { ItemCounts } from './impact-preview'

const AVAILABLE: ItemCounts = { tasks: 7, projects: 2, participations: 11, meetings: 3 }
const NONE: ItemCounts = { tasks: 0, projects: 0, participations: 0, meetings: 0 }

describe('dependentsOf', () => {
  it('inclui o próprio módulo e quem depende dele, direta e indiretamente', () => {
    expect(dependentsOf('backlog')).toEqual([
      'backlog',
      'sprints',
      'checkins',
      'impediments',
      'acceptance',
      'reviewRetro',
      'burndown',
    ])
  })

  it('um módulo sem dependentes devolve só ele mesmo', () => {
    expect(dependentsOf('agenda')).toEqual(['agenda'])
    expect(dependentsOf('core')).toEqual(['core'])
  })

  it('estimativa de horas é dependência de burndown (exige horas OU pontos)', () => {
    expect(dependentsOf('estimates.hours')).toEqual(['estimates.hours', 'burndown'])
  })
})

describe('previewModuleImpact', () => {
  it('desligar o núcleo conta tarefas, projetos e participações, mas não reunião', () => {
    expect(previewModuleImpact('core', AVAILABLE).counts).toEqual({
      tasks: 7,
      projects: 2,
      participations: 11,
      meetings: 0,
    })
  })

  it('desligar a agenda conta só as reuniões', () => {
    expect(previewModuleImpact('agenda', AVAILABLE).counts).toEqual({
      tasks: 0,
      projects: 0,
      participations: 0,
      meetings: 3,
    })
  })

  it('módulo sem itens dá zero em todas as contagens', () => {
    expect(previewModuleImpact('wip', AVAILABLE).counts).toEqual(NONE)
    expect(previewModuleImpact('backlog', AVAILABLE).counts).toEqual(NONE)
  })

  it('não muda com a quantidade de itens zerada, e devolve o módulo pedido', () => {
    expect(previewModuleImpact('agenda', NONE)).toEqual({ moduleId: 'agenda', counts: NONE })
  })

  it('a prévia é só leitura: a entrada não é alterada', () => {
    const available = { ...AVAILABLE }
    previewModuleImpact('core', available)
    expect(available).toEqual(AVAILABLE)
  })
})
