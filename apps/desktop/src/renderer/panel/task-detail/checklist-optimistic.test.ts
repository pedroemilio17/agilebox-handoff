import { describe, expect, it } from 'vitest'
import type { ChecklistItemDto } from '@agilebox/contract'
import { makeDetail } from './fixtures'
import { applyChecklistToggle } from './checklist-optimistic'

const item = (id: string, done: boolean): ChecklistItemDto => ({
  id,
  taskId: makeDetail().id,
  title: `Item ${id}`,
  done,
  position: 0,
  createdAt: '2026-10-31T12:00:00.000Z',
  doneAt: done ? '2026-10-31T12:00:00.000Z' : null,
})

describe('applyChecklistToggle', () => {
  it('marca um item e recalcula o progresso', () => {
    const task = makeDetail({
      checklist: [item('A', true), item('B', false), item('C', false)],
      checklistProgress: { done: 1, total: 3, percent: 33 },
    })
    const next = applyChecklistToggle(task, 'B', true)
    expect(next.checklist.map((entry) => entry.done)).toEqual([true, true, false])
    expect(next.checklistProgress).toEqual({ done: 2, total: 3, percent: 67 })
    expect(task.checklistProgress.done).toBe(1)
  })

  it('desmarca limpando a data de conclusão', () => {
    const task = makeDetail({ checklist: [item('A', true)] })
    const next = applyChecklistToggle(task, 'A', false)
    expect(next.checklist[0]).toMatchObject({ done: false, doneAt: null })
    expect(next.checklistProgress).toEqual({ done: 0, total: 1, percent: 0 })
  })
})
