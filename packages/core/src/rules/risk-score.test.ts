import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { riskBand, riskScore, sortRisksByScore } from './risk-score'

describe('riskScore', () => {
  it('multiplica probabilidade por impacto', () => {
    expect(riskScore(1, 1)).toBe(1)
    expect(riskScore(2, 2)).toBe(4)
    expect(riskScore(3, 3)).toBe(9)
    expect(riskScore(2, 3)).toBe(6)
  })

  it('recusa valores fora de 1 a 3', () => {
    expect(() => riskScore(0, 2)).toThrow(ValidationError)
    expect(() => riskScore(4, 2)).toThrow(ValidationError)
    expect(() => riskScore(2, 1.5)).toThrow(ValidationError)
    expect(() => riskScore(2, 5)).toThrow(ValidationError)
  })
})

describe('riskBand', () => {
  it.each([
    [1, 'low'],
    [2, 'low'],
    [3, 'medium'],
    [4, 'medium'],
    [6, 'high'],
    [9, 'high'],
  ] as const)('pontuação %i vira faixa %s', (score, band) => {
    expect(riskBand(score)).toBe(band)
  })

  it('não tem faixa para 5, nem para valores fora da escala', () => {
    expect(() => riskBand(5)).toThrow(ValidationError)
    expect(() => riskBand(0)).toThrow(ValidationError)
    expect(() => riskBand(10)).toThrow(ValidationError)
  })

  it('a faixa de todo produto possível de probabilidade e impacto existe', () => {
    for (const probability of [1, 2, 3] as const)
      for (const impact of [1, 2, 3] as const)
        expect(() => riskBand(riskScore(probability, impact))).not.toThrow()
  })
})

describe('sortRisksByScore', () => {
  const risk = (id: string, title: string, probability: number, impact: number) => ({
    id,
    title,
    probability,
    impact,
  })

  it('ordena pela pontuação, da maior para a menor', () => {
    const sorted = sortRisksByScore([
      risk('a', 'Baixo', 1, 1),
      risk('b', 'Alto', 3, 3),
      risk('c', 'Médio', 2, 2),
      risk('d', 'Médio alto', 2, 3),
    ])
    expect(sorted.map((item) => item.id)).toEqual(['b', 'd', 'c', 'a'])
  })

  it('desempata pelo título em pt-BR e depois pelo id, sem mudar a entrada', () => {
    const input = [
      risk('z', 'Fornecedor', 2, 2),
      risk('y', 'Equipe', 2, 2),
      risk('x', 'Equipe', 2, 2),
    ]
    const before = [...input]
    const sorted = sortRisksByScore(input)
    expect(sorted.map((item) => item.id)).toEqual(['x', 'y', 'z'])
    expect(input).toEqual(before)
  })

  it('lista vazia continua vazia', () => {
    expect(sortRisksByScore([])).toEqual([])
  })
})
