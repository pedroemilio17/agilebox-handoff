import { describe, expect, it } from 'vitest'
import { DAILY_ANSWER_MAX_LENGTH, createDailyEntry } from './daily-entry'
import type { DailyEntryDraft } from './daily-entry'
import { ValidationError } from '../shared/errors'
import { toDailyEntryId, toOrganizationId, toTaskId, toUserId } from '../shared/ids'

const base: DailyEntryDraft = {
  id: toDailyEntryId('01ARZ3NDEKTSV4RRFFQ69G5FAV'),
  organizationId: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW'),
  userId: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB0'),
  date: '2026-11-04',
  answers: { progress: 'Revisei a API.', nextStep: '', blocker: '' },
  noNews: false,
  taskRefs: [],
  createdAt: '2026-11-04T12:00:00.000Z',
  updatedAt: '2026-11-04T12:00:00.000Z',
}

describe('createDailyEntry', () => {
  it('aceita uma resposta preenchida e normaliza os textos', () => {
    const entry = createDailyEntry({
      ...base,
      answers: { progress: '  Revisei a API.  ', nextStep: '', blocker: '' },
    })
    expect(entry.answers.progress).toBe('Revisei a API.')
    expect(entry.date).toBe('2026-11-04')
  })

  it('aceita "sem novidades" mesmo com as respostas vazias', () => {
    const entry = createDailyEntry({
      ...base,
      answers: { progress: '', nextStep: '', blocker: '' },
      noNews: true,
    })
    expect(entry.noNews).toBe(true)
  })

  it('recusa daily vazia sem "sem novidades", mesmo citando tarefas', () => {
    expect(() =>
      createDailyEntry({
        ...base,
        answers: { progress: '   ', nextStep: '', blocker: '' },
        taskRefs: [toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB1')],
      }),
    ).toThrow(ValidationError)
  })

  it('aceita até 500 caracteres em cada resposta e recusa o 501', () => {
    const max = 'a'.repeat(DAILY_ANSWER_MAX_LENGTH)
    expect(
      createDailyEntry({ ...base, answers: { progress: max, nextStep: '', blocker: '' } }).answers
        .progress,
    ).toHaveLength(DAILY_ANSWER_MAX_LENGTH)
    expect(() =>
      createDailyEntry({
        ...base,
        answers: { progress: '', nextStep: 'a'.repeat(501), blocker: '' },
      }),
    ).toThrow(ValidationError)
    expect(() =>
      createDailyEntry({
        ...base,
        answers: { progress: '', nextStep: '', blocker: 'é'.repeat(501) },
      }),
    ).toThrow(ValidationError)
  })

  it('conta caracteres e não unidades de código', () => {
    const emoji = '😀'.repeat(DAILY_ANSWER_MAX_LENGTH)
    expect(
      createDailyEntry({ ...base, answers: { progress: emoji, nextStep: '', blocker: '' } }).answers
        .progress,
    ).toBe(emoji)
  })

  it('recusa data inválida', () => {
    expect(() => createDailyEntry({ ...base, date: '2026-02-30' })).toThrow(ValidationError)
  })

  it('descarta taskRefs repetidos', () => {
    const task = toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB1')
    const entry = createDailyEntry({ ...base, taskRefs: [task, task] })
    expect(entry.taskRefs).toEqual([task])
  })
})
