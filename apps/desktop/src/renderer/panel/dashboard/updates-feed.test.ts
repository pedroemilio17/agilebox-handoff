import { describe, expect, it, vi } from 'vitest'
import { ANA, BRUNO, CHAMADOS, ERP, insightsFixture } from './dashboard-fixtures'
import { buildFeed, feedEntries, runFeedAction } from './updates-feed'
import type { FeedFilters } from './updates-feed'
import { FEED_FILTER_ORDER } from './updates-feed'

const NOW = '2026-11-04T12:00:00Z'

function filters(overrides: Partial<FeedFilters> = {}): FeedFilters {
  return {
    view: 'hoje',
    types: new Set(FEED_FILTER_ORDER),
    projects: new Set([CHAMADOS, ERP]),
    people: new Set([BRUNO, ANA]),
    groupByTask: false,
    showOwn: true,
    ...overrides,
  }
}

describe('feedEntries', () => {
  it('traduz sinais e movimentos para tipo, tom e ação da linha', () => {
    const { needs, events } = feedEntries(insightsFixture())
    expect(needs.map((entry) => [entry.filter, entry.actionLabel])).toEqual([
      ['wip', 'Ver quadro'],
      ['deadline', 'Abrir cronograma'],
      ['acceptance', 'Revisar'],
    ])
    expect(needs[0]!.typeLabel).toBe('WIP e paradas')
    expect(needs[0]!.tone).toBe('danger')
    expect(events[0]).toMatchObject({
      filter: 'estimate',
      typeLabel: 'Estimativa e custo',
      headline: 'Estimativa do módulo de chamados',
      actionLabel: 'Abrir tarefa',
    })
  })
})

describe('buildFeed: visões', () => {
  it('Exige ação mostra só os sinais; Tudo de hoje só os movimentos de hoje', () => {
    const insights = insightsFixture()
    const exige = buildFeed(insights, filters({ view: 'exige' }), NOW)
    // Sinal com hora vai para o dia dele (desenho: linhas com hora em "Hoje"); marco sem hora fica em "Em aberto".
    expect(exige.open.map((item) => item.head.filter)).toEqual(['deadline'])
    expect(exige.days.flatMap((day) => day.items.map((item) => item.head.filter))).toEqual([
      'wip',
      'acceptance',
    ])
    expect(exige.viewCounts).toEqual({ exige: 3, hoje: 2, marcos: 2 })
  })

  it('Marcos e prazos junta o prazo dos movimentos e o marco em risco', () => {
    const model = buildFeed(insightsFixture(), filters({ view: 'marcos' }), NOW)
    expect(model.open.map((item) => item.head.filter)).toEqual(['deadline'])
    expect(model.days.flatMap((day) => day.items.map((item) => item.head.filter))).toEqual([
      'deadline',
    ])
  })
})

describe('buildFeed: filtros e agrupamento', () => {
  it('"Mostrar minhas edições" desligado esconde as edições do gestor', () => {
    const hidden = buildFeed(insightsFixture(), filters({ view: 'marcos', showOwn: false }), NOW)
    expect(hidden.days).toEqual([])
    const shown = buildFeed(insightsFixture(), filters({ view: 'marcos', showOwn: true }), NOW)
    expect(shown.days.flatMap((day) => day.items)).toHaveLength(1)
  })

  it('pessoa e projeto filtram os movimentos; os totais não mudam', () => {
    const insights = insightsFixture()
    const byAna = buildFeed(insights, filters({ view: 'hoje', people: new Set([ANA]) }), NOW)
    expect(byAna.days.flatMap((day) => day.items)).toHaveLength(2)
    // A edição de Bruno é de 03/11: fora de "Tudo de hoje" em 04/11.
    const byBruno = buildFeed(insights, filters({ view: 'hoje', people: new Set([BRUNO]) }), NOW)
    expect(byBruno.days.flatMap((day) => day.items)).toHaveLength(0)
    const byErp = buildFeed(insights, filters({ view: 'marcos', projects: new Set([ERP]) }), NOW)
    expect(byErp.days.flatMap((day) => day.items)).toHaveLength(1)
    expect(byErp.typeCounts.estimate).toBe(1)
    expect(byErp.total).toBe(3)
  })

  it('tipo desligado some da lista e a contagem continua a mesma', () => {
    const model = buildFeed(
      insightsFixture(),
      filters({ view: 'exige', types: new Set(['wip']) }),
      NOW,
    )
    expect(model.days.flatMap((day) => day.items.map((item) => item.head.filter))).toEqual(['wip'])
    expect(model.typeCounts.acceptance).toBe(1)
  })

  it('agrupar por tarefa junta as edições da mesma tarefa no mesmo dia', () => {
    const insights = insightsFixture()
    const grouped = buildFeed(insights, filters({ view: 'hoje', groupByTask: true }), NOW)
    expect(grouped.days).toHaveLength(1)
    const [item] = grouped.days[0]!.items
    expect(item!.head.filter).toBe('estimate')
    expect(item!.rest.map((entry) => entry.filter)).toEqual(['status'])
    expect(grouped.visible).toBe(2)
  })

  it('sem agrupar, cada movimento é uma linha', () => {
    const model = buildFeed(insightsFixture(), filters({ view: 'hoje', groupByTask: false }), NOW)
    const items = model.days.flatMap((day) => day.items)
    expect(items.every((item) => item.rest.length === 0)).toBe(true)
  })
})

describe('runFeedAction', () => {
  it('leva ao quadro, ao cronograma ou à tarefa, conforme a ação', () => {
    const handlers = { onOpenProject: vi.fn(), onOpenTask: vi.fn() }
    runFeedAction({ kind: 'board', projectId: CHAMADOS }, handlers)
    runFeedAction({ kind: 'schedule', projectId: ERP }, handlers)
    runFeedAction({ kind: 'task', taskId: 'T1' }, handlers)
    expect(handlers.onOpenProject).toHaveBeenNthCalledWith(1, CHAMADOS, 'board')
    expect(handlers.onOpenProject).toHaveBeenNthCalledWith(2, ERP, 'schedule')
    expect(handlers.onOpenTask).toHaveBeenCalledWith('T1')
  })
})
