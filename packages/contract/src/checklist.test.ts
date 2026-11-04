import { describe, expect, it } from 'vitest'
import {
  addChecklistItemInputSchema,
  checklistItemDtoSchema,
  checklistProgressDtoSchema,
  moveChecklistItemInputSchema,
  toggleChecklistItemInputSchema,
} from './checklist'

const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const itemId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

describe('contrato de subtarefas', () => {
  it('aceita título de 1 a 200 caracteres sem contar só espaços', () => {
    expect(addChecklistItemInputSchema.safeParse({ taskId, title: 'Testar' }).success).toBe(true)
    expect(addChecklistItemInputSchema.safeParse({ taskId, title: '   ' }).success).toBe(false)
    expect(addChecklistItemInputSchema.safeParse({ taskId, title: 'a'.repeat(200) }).success).toBe(
      true,
    )
    expect(addChecklistItemInputSchema.safeParse({ taskId, title: 'a'.repeat(201) }).success).toBe(
      false,
    )
  })

  it('exige booleano em marcar e posição inteira não negativa em mover', () => {
    expect(toggleChecklistItemInputSchema.safeParse({ taskId, itemId, done: true }).success).toBe(
      true,
    )
    expect(toggleChecklistItemInputSchema.safeParse({ taskId, itemId }).success).toBe(false)
    expect(moveChecklistItemInputSchema.safeParse({ taskId, itemId, position: 0 }).success).toBe(
      true,
    )
    expect(moveChecklistItemInputSchema.safeParse({ taskId, itemId, position: -1 }).success).toBe(
      false,
    )
    expect(moveChecklistItemInputSchema.safeParse({ taskId, itemId, position: 1.5 }).success).toBe(
      false,
    )
  })

  it('valida o DTO do item e o progresso', () => {
    const item = {
      id: itemId,
      taskId,
      title: 'Revisar',
      done: true,
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      doneAt: '2026-01-02T00:00:00.000Z',
    }
    expect(checklistItemDtoSchema.safeParse(item).success).toBe(true)
    expect(checklistItemDtoSchema.safeParse({ ...item, doneAt: null }).success).toBe(true)
    expect(checklistProgressDtoSchema.safeParse({ done: 2, total: 5, percent: 40 }).success).toBe(
      true,
    )
    expect(checklistProgressDtoSchema.safeParse({ done: 2, total: 5, percent: 101 }).success).toBe(
      false,
    )
  })
})
