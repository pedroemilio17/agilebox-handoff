import { describe, expect, it } from 'vitest'
import { kpiText, trendPaths } from './dashboard-format'
import type { ProjectKpi } from './dashboard-format'

describe('kpiText (indicador principal do cartão)', () => {
  it('Ágil: sprint, dia de N, horas restantes e fim', () => {
    const kpi: ProjectKpi = {
      kind: 'sprint',
      sprint: { number: 4, day: 7, totalDays: 10, remainingHours: 30, endsOn: '2026-11-12' },
    }
    expect(kpiText(kpi)).toEqual({
      label: 'Sprint 4 · dia 7 de 10',
      value: '30 h restantes',
      sub: 'termina em 12/11',
    })
  })

  it('Tradicional com foto: "Concluído contra a base", semana e custo gasto em reais', () => {
    const kpi: ProjectKpi = {
      kind: 'progress',
      percent: 34,
      done: 9,
      total: 26,
      week: { current: 3, total: 13 },
      spentCost: 9630,
      baselineDeviationDays: 2,
    }
    expect(kpiText(kpi)).toEqual({
      label: 'Concluído contra a base',
      value: '34%',
      sub: 'semana 3 de 13 · R$ 9.630 gastos',
    })
  })

  it('sem cronograma nem custo: sub mostra tarefas concluídas, e sem foto o rótulo é "Concluído"', () => {
    const kpi: ProjectKpi = {
      kind: 'progress',
      percent: 50,
      done: 2,
      total: 4,
      week: null,
      spentCost: null,
      baselineDeviationDays: null,
    }
    expect(kpiText(kpi)).toEqual({ label: 'Concluído', value: '50%', sub: '2 de 4 tarefas' })
  })

  it('Híbrido: marco com dias e percentual, com a sprint quando há uma ativa', () => {
    const kpi: ProjectKpi = {
      kind: 'milestone',
      title: 'Entrega 1',
      daysLeft: 11,
      percent: 58,
      sprint: { number: 2, day: 3, totalDays: 10, remainingHours: 30, endsOn: '2026-11-20' },
    }
    expect(kpiText(kpi)).toEqual({
      label: 'Entrega 1 · marco em 11 dias',
      value: '58% feito',
      sub: 'Sprint 2 · dia 3 de 10 · 30 h restantes',
    })
  })

  it('marco vencido e marco hoje', () => {
    const base = { kind: 'milestone' as const, title: 'Entrega 1', percent: 10, sprint: null }
    expect(kpiText({ ...base, daysLeft: -2 }).label).toBe('Entrega 1 · marco venceu há 2 dias')
    expect(kpiText({ ...base, daysLeft: 0 }).label).toBe('Entrega 1 · marco hoje')
  })

  it('Kanban: lead time em dias e tarefas concluídas na semana', () => {
    expect(kpiText({ kind: 'flow', leadDays: 2.1, completedLastWeek: 12 })).toEqual({
      label: 'Lead time médio',
      value: '2,1 dias',
      sub: '12 tarefas concluídas na semana',
    })
    expect(kpiText({ kind: 'flow', leadDays: null, completedLastWeek: 1 })).toEqual({
      label: 'Lead time médio',
      value: '—',
      sub: '1 tarefa concluída na semana',
    })
  })
})

describe('trendPaths (gráfico pequeno, mesma escala do desenho)', () => {
  it('sem referência, não há linha de referência', () => {
    const paths = trendPaths({ reference: null, actual: [0, 10] })
    expect(paths.reference).toBeNull()
    expect(paths.actual).toBe('M0.0 38.0 L260.0 4.0')
  })

  it('valores nulos quebram a linha (dias ainda sem medida)', () => {
    const paths = trendPaths({ reference: [10, 5, 0], actual: [10, null, 2] })
    expect(paths.actual).toBe('M0.0 4.0 M260.0 31.2')
    expect(paths.reference).toBe('M0.0 4.0 L130.0 21.0 L260.0 38.0')
  })

  it('o maior valor (referência ou real) ocupa o topo; zero fica na base', () => {
    const paths = trendPaths({ reference: [4, 0], actual: [0, 4] })
    expect(paths.reference).toBe('M0.0 4.0 L260.0 38.0')
    expect(paths.actual).toBe('M0.0 38.0 L260.0 4.0')
  })
})
