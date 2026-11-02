import { describe, expect, it } from 'vitest'
import {
  acceptanceCriterionDtoSchema,
  acceptanceSummaryDtoSchema,
  addAcceptanceInputSchema,
  criteriaViewOutputSchema,
  criterionTextSchema,
  editAcceptanceInputSchema,
  listAcceptanceInputSchema,
  removeAcceptanceInputSchema,
  reorderAcceptanceInputSchema,
  setAcceptanceDoneInputSchema,
} from './acceptance'

const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const criterionId = '01ARZ3NDEKTSV4RRFFQ69G5FAY'

const criterion = { id: criterionId, text: 'Login com e-mail', done: false }

describe('texto do critério', () => {
  it('aceita texto com trim e até 200 pontos de código', () => {
    expect(criterionTextSchema.parse('  Login com e-mail  ')).toBe('Login com e-mail')
    expect(criterionTextSchema.parse('a'.repeat(200))).toBe('a'.repeat(200))
    expect(criterionTextSchema.parse('  ação 🚀  ')).toBe('ação 🚀')
  })

  it('conta pontos de código, não unidades UTF-16: 200 emojis passam, 201 não', () => {
    const emoji = '🚀'
    expect(criterionTextSchema.safeParse(emoji.repeat(200)).success).toBe(true)
    expect(criterionTextSchema.safeParse(emoji.repeat(201)).success).toBe(false)
  })

  it('recusa vazio, só espaços, só invisíveis e acima de 200 pontos de código', () => {
    expect(criterionTextSchema.safeParse('').success).toBe(false)
    expect(criterionTextSchema.safeParse('   ').success).toBe(false)
    expect(criterionTextSchema.safeParse('​﻿').success).toBe(false)
    expect(criterionTextSchema.safeParse('a'.repeat(201)).success).toBe(false)
  })

  it('recusa caracteres de controle no meio do texto (quebra de linha, tabulação, NUL)', () => {
    expect(criterionTextSchema.safeParse('linha um\nlinha dois').success).toBe(false)
    expect(criterionTextSchema.safeParse('a\tb').success).toBe(false)
    expect(criterionTextSchema.safeParse('a\u0000b').success).toBe(false)
  })

  it('recusa valor que não é texto', () => {
    expect(criterionTextSchema.safeParse(null).success).toBe(false)
    expect(criterionTextSchema.safeParse(42).success).toBe(false)
  })
})

describe('schemas de entrada do aceite', () => {
  it('lista pelo id da tarefa e recusa id malformado', () => {
    expect(listAcceptanceInputSchema.parse({ taskId })).toEqual({ taskId })
    expect(listAcceptanceInputSchema.safeParse({ taskId: 'tarefa-1' }).success).toBe(false)
  })

  it('acrescenta e renomeia com texto válido; recusa texto vazio e id de critério malformado', () => {
    expect(addAcceptanceInputSchema.parse({ taskId, text: '  Novo  ' })).toEqual({
      taskId,
      text: 'Novo',
    })
    expect(addAcceptanceInputSchema.safeParse({ taskId, text: ' ' }).success).toBe(false)
    expect(editAcceptanceInputSchema.parse({ taskId, criterionId, text: 'Trocado' })).toEqual({
      taskId,
      criterionId,
      text: 'Trocado',
    })
    expect(
      editAcceptanceInputSchema.safeParse({ taskId, criterionId: 'criterio-1', text: 'Trocado' })
        .success,
    ).toBe(false)
    expect(editAcceptanceInputSchema.safeParse({ taskId, criterionId }).success).toBe(false)
  })

  it('marca e desmarca só com booleano; recusa texto no lugar de booleano', () => {
    expect(setAcceptanceDoneInputSchema.parse({ taskId, criterionId, done: true })).toEqual({
      taskId,
      criterionId,
      done: true,
    })
    expect(
      setAcceptanceDoneInputSchema.safeParse({ taskId, criterionId, done: 'sim' }).success,
    ).toBe(false)
    expect(setAcceptanceDoneInputSchema.safeParse({ taskId, criterionId }).success).toBe(false)
  })

  it('remove pelo id do critério', () => {
    expect(removeAcceptanceInputSchema.parse({ taskId, criterionId })).toEqual({
      taskId,
      criterionId,
    })
    expect(removeAcceptanceInputSchema.safeParse({ taskId, criterionId: 'x' }).success).toBe(false)
  })

  it('reordena para índice inteiro não negativo; recusa negativo, fracionado, NaN e texto', () => {
    expect(reorderAcceptanceInputSchema.parse({ taskId, criterionId, toIndex: 0 })).toEqual({
      taskId,
      criterionId,
      toIndex: 0,
    })
    expect(reorderAcceptanceInputSchema.parse({ taskId, criterionId, toIndex: 4 }).toIndex).toBe(4)
    for (const toIndex of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '2', null]) {
      expect(reorderAcceptanceInputSchema.safeParse({ taskId, criterionId, toIndex }).success).toBe(
        false,
      )
    }
  })
})

describe('schemas de saída do aceite', () => {
  it('aceita critério com id, texto e situação, e recusa id malformado', () => {
    expect(acceptanceCriterionDtoSchema.parse(criterion)).toEqual(criterion)
    expect(acceptanceCriterionDtoSchema.safeParse({ ...criterion, id: 'criterio-1' }).success).toBe(
      false,
    )
    expect(acceptanceCriterionDtoSchema.safeParse({ ...criterion, done: 'sim' }).success).toBe(
      false,
    )
  })

  it('resumo n/m: feitos não podem passar do total, e nenhum número pode ser negativo', () => {
    expect(acceptanceSummaryDtoSchema.parse({ done: 1, total: 3 })).toEqual({ done: 1, total: 3 })
    expect(acceptanceSummaryDtoSchema.parse({ done: 0, total: 0 })).toEqual({ done: 0, total: 0 })
    expect(acceptanceSummaryDtoSchema.safeParse({ done: 4, total: 3 }).success).toBe(false)
    expect(acceptanceSummaryDtoSchema.safeParse({ done: -1, total: 3 }).success).toBe(false)
  })

  it('a lista devolvida precisa bater com o resumo (total e feitos)', () => {
    const view = {
      criteria: [criterion, { id: '01ARZ3NDEKTSV4RRFFQ69G5FAZ', text: 'Logout', done: true }],
      summary: { done: 1, total: 2 },
    }
    expect(criteriaViewOutputSchema.parse(view)).toEqual(view)
    expect(
      criteriaViewOutputSchema.safeParse({ ...view, summary: { done: 0, total: 2 } }).success,
    ).toBe(false)
    expect(
      criteriaViewOutputSchema.safeParse({ ...view, summary: { done: 1, total: 3 } }).success,
    ).toBe(false)
    expect(
      criteriaViewOutputSchema.parse({ criteria: [], summary: { done: 0, total: 0 } }),
    ).toEqual({ criteria: [], summary: { done: 0, total: 0 } })
  })
})
