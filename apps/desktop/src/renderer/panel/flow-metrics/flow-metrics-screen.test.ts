import { describe, expect, it } from 'vitest'
import type { FlowMetricsViewDto } from '@agilebox/contract'
import {
  CHART,
  flowChart,
  flowMetricsCopy,
  flowSummary,
  formatDays,
  headerSubtitle,
  perWeekText,
  SMALL_SAMPLE,
  yScale,
} from './flow-metrics-screen'

function view(overrides: Partial<FlowMetricsViewDto> = {}): FlowMetricsViewDto {
  const starts = [
    '2025-11-10',
    '2025-11-17',
    '2025-11-24',
    '2025-12-01',
    '2025-12-08',
    '2025-12-15',
    '2025-12-22',
    '2025-12-29',
  ]
  return {
    projectId: '01J8Y4G2XK8Z1S6M3Q9W0FGHKA',
    today: '2026-01-02',
    windowStart: '2025-11-10',
    windowEnd: '2026-01-05',
    leadDays: 4.5,
    cycleDays: 4,
    completed: 3,
    weeks: starts.map((start, index) => ({
      start,
      completed: index === 6 ? 1 : index === 7 ? 2 : 0,
    })),
    ...overrides,
  }
}

describe('textos e números', () => {
  it('formata dias com uma casa decimal e singular, e nulo como travessão', () => {
    expect(formatDays(null)).toBe('—')
    expect(formatDays(4.24)).toBe('4,2 dias')
    expect(formatDays(1)).toBe('1 dia')
    expect(formatDays(0)).toBe('0 dias')
  })

  it('média por semana com uma casa decimal', () => {
    expect(perWeekText(12, 8)).toBe('1,5')
    expect(perWeekText(0, 8)).toBe('0')
  })

  it('subtítulo mostra a janela até o último dia, sem o fim exclusivo', () => {
    expect(headerSubtitle(view())).toBe('Últimas 8 semanas · 10/11 a 04/01')
  })

  it('a amostra pequena começa em cinco tarefas concluídas', () => {
    expect(SMALL_SAMPLE).toBe(5)
    expect(flowMetricsCopy.sampleNote(1)).toContain('1 tarefa concluída')
    expect(flowMetricsCopy.sampleNote(3)).toContain('3 tarefas concluídas')
  })
})

describe('escala e geometria do gráfico', () => {
  it('o domínio cabe o maior valor com passo inteiro', () => {
    expect(yScale(0)).toEqual({ domain: 1, step: 1 })
    expect(yScale(2)).toEqual({ domain: 2, step: 1 })
    expect(yScale(7)).toEqual({ domain: 8, step: 2 })
  })

  it('uma barra por semana, com a altura proporcional ao maior valor', () => {
    const chart = flowChart(view())
    const innerHeight = CHART.height - CHART.top - CHART.bottom
    expect(chart.bars).toHaveLength(8)
    // Domínio 2: a barra de 2 ocupa toda a altura interna, a de 1 a metade.
    const last = chart.bars.at(-1)!
    const previous = chart.bars.at(-2)!
    expect(last.height).toBeCloseTo(innerHeight, 5)
    expect(last.y).toBeCloseTo(CHART.top, 5)
    expect(previous.height).toBeCloseTo(innerHeight / 2, 5)
    expect(chart.bars[0]!.height).toBe(0)
    expect(chart.bars[0]!.label).toBe('10/11')
    expect(chart.ticks.map((tick) => tick.value)).toEqual([0, 1, 2])
  })

  it('barras de semanas diferentes não se sobrepõem', () => {
    const bars = flowChart(view()).bars
    for (let index = 1; index < bars.length; index++) {
      expect(bars[index]!.x).toBeGreaterThanOrEqual(bars[index - 1]!.x + bars[index - 1]!.width)
    }
  })
})

describe('resumo textual', () => {
  it('traz as contagens por semana, o total e as médias', () => {
    const summary = flowSummary(view())
    expect(summary).toContain('22/12: 1')
    expect(summary).toContain('29/12: 2')
    expect(summary).toContain('Total de 3 tarefas concluídas nas últimas 8 semanas.')
    expect(summary).toContain('Lead time médio de 4,5 dias.')
    expect(summary).toContain('Cycle time médio de 4 dias.')
  })

  it('sem médias, não menciona lead nem cycle', () => {
    const summary = flowSummary(view({ leadDays: null, cycleDays: null, completed: 0 }))
    expect(summary).not.toContain('Lead time')
    expect(summary).not.toContain('Cycle time')
  })
})
