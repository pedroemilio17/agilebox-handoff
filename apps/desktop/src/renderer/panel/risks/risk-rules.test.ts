import { describe, expect, it } from 'vitest'
import {
  idOrNull,
  levelLabel,
  riskSummary,
  statusLabel,
  textOrNull,
  validateRiskForm,
  type RiskFormValues,
} from './risk-rules'

const base: RiskFormValues = {
  title: 'Fornecedor atrasa',
  description: '',
  probability: 2,
  impact: 2,
  response: '',
  ownerId: '',
  deliverableId: '',
  status: 'open',
}

describe('riskSummary', () => {
  it.each([
    [1, 1, 'Baixo · pontuação 1'],
    [2, 2, 'Médio · pontuação 4'],
    [2, 3, 'Alto · pontuação 6'],
    [3, 3, 'Alto · pontuação 9'],
  ] as const)('probabilidade %i e impacto %i dizem "%s"', (probability, impact, text) => {
    expect(riskSummary(probability, impact).text).toBe(text)
  })

  it('a faixa vem com texto, não só com cor', () => {
    expect(riskSummary(3, 2).bandLabel).toBe('Alto')
    expect(riskSummary(1, 2).bandLabel).toBe('Baixo')
    expect(riskSummary(2, 2).band).toBe('medium')
  })
})

describe('rótulos', () => {
  it('níveis e situações em pt-BR', () => {
    expect(levelLabel(1)).toBe('Baixa')
    expect(levelLabel(2)).toBe('Média')
    expect(levelLabel(3)).toBe('Alta')
    expect(statusLabel('open')).toBe('Aberto')
    expect(statusLabel('mitigated')).toBe('Mitigado')
    expect(statusLabel('occurred')).toBe('Ocorreu')
    expect(statusLabel('closed')).toBe('Encerrado')
  })
})

describe('validateRiskForm', () => {
  it('aceita o formulário mínimo', () => {
    expect(validateRiskForm(base)).toEqual({})
  })

  it('exige título e recusa título longo', () => {
    expect(validateRiskForm({ ...base, title: '   ' }).title).toBeDefined()
    expect(validateRiskForm({ ...base, title: 'a'.repeat(201) }).title).toBeDefined()
    expect(validateRiskForm({ ...base, title: 'a'.repeat(200) }).title).toBeUndefined()
  })

  it('limita descrição e resposta', () => {
    expect(validateRiskForm({ ...base, description: 'd'.repeat(1001) }).description).toBeDefined()
    expect(validateRiskForm({ ...base, response: 'r'.repeat(281) }).response).toBeDefined()
  })
})

describe('envio', () => {
  it('texto e seletor vazios viram nulo', () => {
    expect(textOrNull('  ')).toBeNull()
    expect(textOrNull(' Negociar ')).toBe('Negociar')
    expect(idOrNull('')).toBeNull()
    expect(idOrNull('01J8Y4G2XK8Z1S6M3Q9W0ABCDE')).toBe('01J8Y4G2XK8Z1S6M3Q9W0ABCDE')
  })
})
