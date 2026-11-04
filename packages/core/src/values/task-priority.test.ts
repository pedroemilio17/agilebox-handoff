import { describe, expect, expectTypeOf, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import {
  isTaskPriority,
  parseTaskPriority,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITIES,
} from './task-priority'
import type { TaskPriority } from './task-priority'

describe('prioridade da tarefa', () => {
  it('mantém os valores e os rótulos em pt-BR', () => {
    expect(TASK_PRIORITIES).toEqual(['normal', 'high'])
    expect(TASK_PRIORITY_LABELS).toEqual({ normal: 'Normal', high: 'Alta' })
  })

  it.each(['normal', 'high'])('aceita %s', (value) => {
    expect(isTaskPriority(value)).toBe(true)
    expect(parseTaskPriority(value)).toBe(value)
  })

  it.each(['', 'HIGH', 'high ', 'urgent', 'alta'])('rejeita %j', (value) => {
    expect(isTaskPriority(value)).toBe(false)
    expect(() => parseTaskPriority(value)).toThrow(ValidationError)
    expect(() => parseTaskPriority(value)).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
  })

  it('expõe a união dos dois valores', () => {
    expectTypeOf<TaskPriority>().toEqualTypeOf<'normal' | 'high'>()
  })
})
