import { describe, expect, it } from 'vitest'
import {
  BASELINE_GLYPHS,
  BASELINE_STATUS_LABELS,
  BASELINE_TONES,
  baselineCopy,
  dateText,
  deviationCaption,
  hoursValue,
  moneyValue,
  signedDays,
  signedHours,
  signedMoney,
  statusText,
  takenAtLabel,
  takenByText,
} from './baseline-screen'

describe('situação da tarefa: texto, tom e ícone', () => {
  it('mostra o atraso no texto ("Atrasada 3 d"), e os demais estados por nome', () => {
    expect(statusText({ status: 'late', delayDays: 3 })).toBe('Atrasada 3 d')
    expect(statusText({ status: 'on_time', delayDays: 0 })).toBe('No prazo')
    expect(statusText({ status: 'new', delayDays: null })).toBe('Nova')
    expect(statusText({ status: 'removed', delayDays: null })).toBe('Removida')
  })

  it('cada situação tem rótulo, tom e ícone próprios (a cor nunca é o único sinal)', () => {
    expect(BASELINE_STATUS_LABELS).toEqual({
      on_time: 'No prazo',
      late: 'Atrasada',
      new: 'Nova',
      removed: 'Removida',
    })
    expect(new Set(Object.values(BASELINE_TONES)).size).toBe(4)
    expect(new Set(Object.values(BASELINE_GLYPHS)).size).toBe(4)
  })
})

describe('valores com sinal', () => {
  it('dias: positivo com sinal de mais, negativo com menos, zero sem sinal, nulo com travessão', () => {
    expect(signedDays(3)).toBe('+3 d')
    expect(signedDays(-2)).toBe('−2 d')
    expect(signedDays(0)).toBe('0 d')
    expect(signedDays(null)).toBe('—')
  })

  it('leitura do desvio do fim em palavras', () => {
    expect(deviationCaption(5)).toBe('Fim atrasado')
    expect(deviationCaption(-1)).toBe('Fim adiantado')
    expect(deviationCaption(0)).toBe('No prazo')
    expect(deviationCaption(null)).toBe('Sem datas para comparar')
  })

  it('horas com vírgula pt-BR e sinal', () => {
    expect(signedHours(2)).toBe('+2 h')
    expect(signedHours(-1.5)).toBe('−1,5 h')
    expect(signedHours(0)).toBe('0 h')
    expect(signedHours(null)).toBe('—')
    expect(hoursValue(46)).toBe('46 h')
  })

  it('reais com sinal e formato BRL; sem valor, travessão', () => {
    expect(signedMoney(90)).toMatch(/^\+R\$\s90,00$/)
    expect(signedMoney(-10)).toMatch(/^−R\$\s10,00$/)
    expect(signedMoney(0)).toMatch(/^R\$\s0,00$/)
    expect(signedMoney(null)).toBe('—')
    expect(moneyValue(360)).toMatch(/^R\$\s360,00$/)
    expect(moneyValue(null)).toBe('—')
  })
})

describe('datas', () => {
  it('data curta do cronograma, e travessão sem data', () => {
    expect(dateText('2026-11-10')).toMatch(/^\S+ 10\/11$/)
    expect(dateText(null)).toBe('—')
  })

  it('foto: data e hora com quem tirou; sem nome, "alguém da equipe"', () => {
    expect(takenAtLabel('not a date')).toBe('—')
    expect(takenAtLabel('2026-11-18T12:00:00.000Z')).toMatch(/18\/11\/2026/)
    expect(takenByText('2026-11-18T12:00:00.000Z', 'Gestora')).toMatch(/por Gestora$/)
    expect(takenByText('2026-11-18T12:00:00.000Z', null)).toMatch(
      new RegExp(`por ${baselineCopy.unknownTaker}$`),
    )
  })
})
