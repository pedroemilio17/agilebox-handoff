import { describe, expect, it } from 'vitest'
import { ITEM_DESTINATION, ITEM_KINDS, dependentsOf, previewModuleImpact } from './impact-preview'
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

describe('destino por tipo', () => {
  it('tarefas ficam no Quadro e reuniões ficam escondidas (P2 padrão B)', () => {
    expect(ITEM_DESTINATION).toEqual({ tasks: 'board', meetings: 'hidden' })
  })

  it('todo destino definido aponta para um tipo que existe', () => {
    for (const kind of Object.keys(ITEM_DESTINATION)) {
      expect(ITEM_KINDS).toContain(kind)
    }
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
    expect(previewModuleImpact('agenda', NONE)).toEqual({
      moduleId: 'agenda',
      counts: NONE,
      items: [{ kind: 'meetings', destination: 'hidden', count: 0 }],
    })
  })

  it('desligar a agenda traz reuniões escondidas, com a contagem', () => {
    expect(previewModuleImpact('agenda', AVAILABLE).items).toEqual([
      { kind: 'meetings', destination: 'hidden', count: 3 },
    ])
  })

  it('desligar o núcleo traz tarefas no Quadro; projetos e participações não passam (sem destino)', () => {
    const { items } = previewModuleImpact('core', AVAILABLE)

    expect(items).toEqual([{ kind: 'tasks', destination: 'board', count: 7 }])
    expect(items.map((item) => item.kind)).toEqual(['tasks'])
  })

  it('módulo que não afeta tarefas nem reuniões não traz itens', () => {
    expect(previewModuleImpact('backlog', AVAILABLE).items).toEqual([])
  })

  it('a prévia é só leitura: a entrada não é alterada', () => {
    const available = { ...AVAILABLE }
    previewModuleImpact('core', available)
    expect(available).toEqual(AVAILABLE)
  })
})
