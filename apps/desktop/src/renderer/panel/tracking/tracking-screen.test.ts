import { describe, expect, it } from 'vitest'
import {
  costCaption,
  costValue,
  daysLeftLabel,
  headerSubtitle,
  hoursCaption,
  hoursValue,
  MILESTONE_GLYPHS,
  MILESTONE_STATUS_LABELS,
  MILESTONE_TONES,
  nextMilestoneWhen,
  progressCaption,
  weekText,
} from './tracking-screen'

describe('weekText e headerSubtitle', () => {
  it('mostra a semana quando há intervalo e omite a parte sem ele', () => {
    expect(weekText({ current: 3, total: 13 })).toBe('semana 3 de 13')
    expect(weekText(null)).toBeNull()
    expect(headerSubtitle('Implantação ERP', { current: 3, total: 13 })).toBe(
      'Implantação ERP · semana 3 de 13',
    )
    expect(headerSubtitle('Implantação ERP', null)).toBe('Implantação ERP')
    expect(headerSubtitle(null, null)).toBe('')
  })
})

describe('valores dos cartões', () => {
  it('horas com vírgula pt-BR e a previsão no texto', () => {
    expect(hoursValue(214)).toBe('214 h')
    expect(hoursValue(12.5)).toBe('12,5 h')
    expect(hoursCaption(590)).toBe('de 590 h previstas no projeto')
  })

  it('custo em reais, e "—" quando não há valor (quem não é gestor)', () => {
    expect(costValue(9630)).toBe('R$ 9.630,00')
    expect(costCaption(26550)).toBe('de R$ 26.550,00 previstos')
    expect(costValue(null)).toBe('—')
    expect(costCaption(null)).toBe('—')
  })

  it('progresso com a contagem de tarefas', () => {
    expect(progressCaption(2, 7)).toBe('2 de 7 tarefas concluídas')
  })
})

describe('próximo marco', () => {
  it('dias em palavras: hoje, amanhã e em N dias', () => {
    expect(daysLeftLabel(0)).toBe('hoje')
    expect(daysLeftLabel(1)).toBe('amanhã')
    expect(daysLeftLabel(31)).toBe('em 31 dias')
    expect(nextMilestoneWhen('2026-12-18', 31)).toMatch(/^\S+ 18\/12 · em 31 dias$/)
  })
})

describe('estado do marco', () => {
  it('cada estado tem rótulo em texto, ícone e tom próprios', () => {
    expect(MILESTONE_STATUS_LABELS).toEqual({
      done: 'Cumprido',
      at_risk: 'Em risco',
      on_track: 'No prazo',
    })
    expect(MILESTONE_GLYPHS).toEqual({ done: '✓', at_risk: '!', on_track: '●' })
    expect(MILESTONE_TONES).toEqual({ done: 'done', at_risk: 'risk', on_track: 'track' })
    // Os três ícones são diferentes: a informação não depende da cor.
    expect(new Set(Object.values(MILESTONE_GLYPHS)).size).toBe(3)
  })
})
