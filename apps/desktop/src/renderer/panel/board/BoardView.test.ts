import { describe, expect, it, vi } from 'vitest'
import type { TaskDto } from '@agilebox/contract'
import { moveTaskAfterDrop } from './BoardView'

const task: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
  number: 118,
  key: 'AB-118',
  projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
  projectName: 'Projeto Aurora',
  title: 'Revisar integração',
  description: '',
  status: 'review',
  priority: 'normal',
  blockedReason: null,
  blockedAt: null,
  checklistProgress: { done: 0, total: 0, percent: 0 },
  deadline: null,
  ticketId: null,
  ticketUrl: null,
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
}

describe('Arrastar tarefas no quadro', () => {
  it('ao soltar em outra coluna chama move com o estado da coluna', () => {
    const moveTask = vi.fn()

    moveTaskAfterDrop(task.id, 'in_progress', [task], moveTask)

    expect(moveTask).toHaveBeenCalledWith(task.id, 'in_progress')
  })
})
