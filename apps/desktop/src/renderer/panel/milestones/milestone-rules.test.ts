import { describe, expect, it } from 'vitest'
import {
  criterionOrNull,
  daysLeftText,
  daysUntil,
  shortDateLabel,
  validateMilestoneForm,
} from './milestone-rules'

describe('data curta dos marcos', () => {
  it('mostra o dia da semana e dia/mês, sem depender do fuso', () => {
    expect(shortDateLabel('2026-12-18')).toBe('sex 18/12')
    expect(shortDateLabel('2026-01-01')).toBe('qui 01/01')
  })
})

describe('dias restantes', () => {
  it('conta dias corridos entre hoje e a data', () => {
    expect(daysUntil('2026-12-18', '2026-12-10')).toBe(8)
    expect(daysUntil('2026-12-10', '2026-12-18')).toBe(-8)
  })

  it('texto só para hoje ou o futuro; passado não mostra nada', () => {
    expect(daysLeftText('2026-12-18', '2026-12-17')).toBe('falta 1 dia')
    expect(daysLeftText('2026-12-18', '2026-12-10')).toBe('faltam 8 dias')
    expect(daysLeftText('2026-12-18', '2026-12-18')).toBe('hoje')
    expect(daysLeftText('2026-12-18', '2026-12-19')).toBeNull()
  })
})

describe('validação do formulário de marco', () => {
  const valid = { title: 'Homologação', dueOn: '2026-12-18', criterion: '' }

  it('aceita um marco completo e o critério vazio', () => {
    expect(validateMilestoneForm(valid)).toEqual({})
  })

  it('exige título e data, e ignora espaços no título', () => {
    expect(validateMilestoneForm({ ...valid, title: '   ' }).title).toBe('Dê um título ao marco.')
    expect(validateMilestoneForm({ ...valid, dueOn: '' }).dueOn).toBe('Escolha a data do marco.')
  })

  it('recusa título acima de 200 e critério acima de 280 caracteres', () => {
    expect(validateMilestoneForm({ ...valid, title: 'a'.repeat(201) }).title).toMatch(/200/)
    expect(validateMilestoneForm({ ...valid, criterion: 'a'.repeat(281) }).criterion).toMatch(/280/)
  })

  it('critério vazio vira nulo no envio', () => {
    expect(criterionOrNull('   ')).toBeNull()
    expect(criterionOrNull(' Aprovada ')).toBe('Aprovada')
  })
})
