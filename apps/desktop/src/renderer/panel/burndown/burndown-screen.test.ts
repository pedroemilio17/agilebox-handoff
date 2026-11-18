import { describe, expect, it } from 'vitest'
import type { BurndownViewDto } from '@agilebox/contract'
import { headerSubtitle, velocityBars, VELOCITY_CHART } from './burndown-screen'

function view(overrides: Partial<BurndownViewDto> = {}): BurndownViewDto {
  return {
    projectId: '01J8Y4G2XK8Z1S6M3Q9W0FGHKA',
    today: '2026-01-02',
    sprint: {
      id: '01J8Y4G2XK8Z1S6M3Q9W0FGHM0',
      number: 4,
      name: 'Sprint 4',
      status: 'active',
      plannedStart: '2026-01-01',
      plannedEnd: '2026-01-03',
    },
    totalHours: 12,
    remainingHours: 8,
    scopeTasks: 3,
    doneTasks: 1,
    unestimatedTasks: 0,
    days: [
      { date: '2026-01-01', idealHours: 12, remainingHours: 12 },
      { date: '2026-01-02', idealHours: 6, remainingHours: 8 },
      { date: '2026-01-03', idealHours: 0, remainingHours: null },
    ],
    velocity: { average: null, sprints: [] },
    ...overrides,
  }
}

describe('headerSubtitle', () => {
  it('sprint ativa mostra o dia de hoje dentro da sprint, como no design', () => {
    expect(headerSubtitle(view())).toBe('Sprint 4 · dia 2 de 3')
  })

  it('sprint ativa sem dia de hoje na série só mostra o estado', () => {
    expect(headerSubtitle(view({ today: '2026-02-10' }))).toBe('Sprint 4 · Ativa')
  })

  it('sprint encerrada mostra o estado e o período', () => {
    const closed = view({
      sprint: { ...view().sprint!, status: 'closed' },
    })
    expect(headerSubtitle(closed)).toBe('Sprint 4 · Encerrada · 01/01 a 03/01')
  })
})

describe('velocityBars', () => {
  it('altura proporcional ao maior valor, com a média como linha', () => {
    const { bars, averageY, max } = velocityBars(
      [
        { number: 1, hours: 50 },
        { number: 2, hours: 25 },
      ],
      37.5,
    )
    expect(max).toBe(50)
    const [first, second] = bars
    expect(first?.name).toBe('S1')
    expect(first?.value).toBe('50')
    expect(first?.height).toBeCloseTo(VELOCITY_CHART.baseline - VELOCITY_CHART.plotTop)
    expect(second?.height).toBeCloseTo((VELOCITY_CHART.baseline - VELOCITY_CHART.plotTop) / 2)
    expect(averageY).toBeCloseTo(VELOCITY_CHART.baseline - (37.5 / 50) * 144)
  })

  it('sem sprints, não há barras nem linha; o piso de 1 h evita divisão por zero', () => {
    expect(velocityBars([], null)).toEqual({ bars: [], averageY: null, max: 1 })
  })
})
