import { describe, expect, it } from 'vitest'
import { API_CHANNELS } from './channels'
import { API_SCHEMA_REGISTRY } from './api'
import {
  addAcceptanceCriterionInputSchema,
  moveAcceptanceCriterionInputSchema,
  removeAcceptanceCriterionInputSchema,
  renameAcceptanceCriterionInputSchema,
  toggleAcceptanceCriterionInputSchema,
} from './acceptance'
import { estimatedHoursSchema, setTaskEstimateInputSchema, taskDtoSchema } from './tasks'
import { timelineEventTypeSchema } from './timeline'

const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const criterionId = '01ARZ3NDEKTSV4RRFFQ69G5FC0'
const projectId = '01ARZ3NDEKTSV4RRFFQ69G5FAX'

describe('schemas de critérios de aceitação (M3.2)', () => {
  it('registra os canais com schemas de entrada e saída', () => {
    for (const channel of [
      'tasks.criteria.add',
      'tasks.criteria.toggle',
      'tasks.criteria.rename',
      'tasks.criteria.remove',
      'tasks.criteria.move',
      'tasks.setEstimate',
    ] as const) {
      expect(API_CHANNELS).toContain(channel)
      expect(API_SCHEMA_REGISTRY[channel]).toBeDefined()
    }
  })

  it('aceita texto de até 200 caracteres e corta espaços', () => {
    expect(
      addAcceptanceCriterionInputSchema.parse({ taskId, text: '  Testado no Windows  ' }).text,
    ).toBe('Testado no Windows')
    expect(
      addAcceptanceCriterionInputSchema.safeParse({ taskId, text: 'x'.repeat(200) }).success,
    ).toBe(true)
  })

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['mais de 200 caracteres', 'x'.repeat(201)],
  ])('recusa texto %s', (_label, text) => {
    expect(addAcceptanceCriterionInputSchema.safeParse({ taskId, text }).success).toBe(false)
  })

  it('conta caracteres, não bytes: 200 acentos passam', () => {
    expect(
      addAcceptanceCriterionInputSchema.safeParse({ taskId, text: 'ç'.repeat(200) }).success,
    ).toBe(true)
  })

  it('recusa identificadores inválidos e posição negativa', () => {
    expect(
      toggleAcceptanceCriterionInputSchema.safeParse({ taskId, criterionId: 'x', done: true })
        .success,
    ).toBe(false)
    expect(
      renameAcceptanceCriterionInputSchema.safeParse({ taskId, criterionId, text: 'ok' }).success,
    ).toBe(true)
    expect(removeAcceptanceCriterionInputSchema.safeParse({ taskId, criterionId }).success).toBe(
      true,
    )
    expect(
      moveAcceptanceCriterionInputSchema.safeParse({ taskId, criterionId, position: -1 }).success,
    ).toBe(false)
    expect(
      moveAcceptanceCriterionInputSchema.safeParse({ taskId, criterionId, position: 2 }).success,
    ).toBe(true)
  })

  it('aceita os tipos de evento de critério e de estimativa na linha do tempo', () => {
    for (const type of [
      'acceptance_criterion_added',
      'acceptance_criterion_removed',
      'acceptance_criterion_done',
      'acceptance_criterion_reopened',
      'acceptance_criterion_renamed',
      'acceptance_criterion_moved',
      'estimate_changed',
    ]) {
      expect(timelineEventTypeSchema.safeParse(type).success, type).toBe(true)
    }
  })

  it('o DTO da tarefa aceita estimativa nula, horas realizadas e rejeita estimativa negativa', () => {
    const base = {
      id: taskId,
      number: 1,
      key: 'AB-1',
      projectId,
      projectName: 'P',
      title: 'T',
      description: '',
      status: 'todo',
      priority: 'normal',
      blockedReason: null,
      blockedAt: null,
      ticketId: null,
      ticketUrl: null,
      deadline: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      checklistProgress: { done: 0, total: 0, percent: 0 },
      commentCount: 0,
    }
    expect(taskDtoSchema.safeParse({ ...base, estimatedHours: null, actualHours: 0 }).success).toBe(
      true,
    )
    expect(taskDtoSchema.safeParse({ ...base, estimatedHours: -1 }).success).toBe(false)
  })
})

describe('estimativa em horas (ADR-07)', () => {
  it.each([0, 0.5, 1.25, 9999, null])('aceita %s', (value) => {
    expect(estimatedHoursSchema.safeParse(value).success).toBe(true)
  })

  it.each([-0.01, 10000, 1.005, Number.NaN, Number.POSITIVE_INFINITY, '2'])(
    'recusa %s',
    (value) => {
      expect(estimatedHoursSchema.safeParse(value).success).toBe(false)
    },
  )

  it('aceita a entrada completa do caso de uso', () => {
    expect(setTaskEstimateInputSchema.safeParse({ taskId, estimatedHours: 2.5 }).success).toBe(true)
    expect(setTaskEstimateInputSchema.safeParse({ taskId, estimatedHours: null }).success).toBe(
      true,
    )
  })
})
