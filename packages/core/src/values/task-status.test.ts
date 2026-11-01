import { describe, expect, expectTypeOf, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { isTaskStatus, parseTaskStatus, TASK_STATUS_LABELS, TASK_STATUSES } from './task-status'
import type { TaskStatus } from './task-status'

describe('estado da tarefa', () => {
  it('mantém os estados e rótulos na ordem do produto', () => {
    expect(TASK_STATUSES).toEqual(['planning', 'todo', 'in_progress', 'review', 'done'])
    expect(TASK_STATUSES.map((status) => TASK_STATUS_LABELS[status])).toEqual([
      'Planejamento',
      'A fazer',
      'Desenvolvendo',
      'Revisar',
      'Concluído',
    ])
  })

  it.each(['planning', 'todo', 'in_progress', 'review', 'done'])('aceita %s', (value) => {
    expect(isTaskStatus(value)).toBe(true)
    expect(parseTaskStatus(value)).toBe(value)
  })

  it.each(['', 'TODO', 'todo ', 'unknown', 'concluído'])('rejeita %j', (value) => {
    expect(isTaskStatus(value)).toBe(false)
    expect(() => parseTaskStatus(value)).toThrow(ValidationError)
    expect(() => parseTaskStatus(value)).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
  })

  it('expõe a união dos cinco estados', () => {
    expectTypeOf<TaskStatus>().toEqualTypeOf<
      'planning' | 'todo' | 'in_progress' | 'review' | 'done'
    >()
  })
})
