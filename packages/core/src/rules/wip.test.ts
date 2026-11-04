import { describe, expect, it } from 'vitest'
import { createTask, setStatus } from '../entities/task'
import type { Task } from '../entities/task'
import { toOrganizationId, toParticipationId, toProjectId, toTaskId, toUserId } from '../shared/ids'
import type { TaskStatus } from '../values/task-status'
import { overWipColumns, wipColumns, wipStatus } from './wip'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')

let counter = 0
function taskIn(status: TaskStatus): Task {
  counter += 1
  const base = createTask({
    id: toTaskId(String(counter).padStart(26, '0')),
    organizationId,
    number: counter,
    projectId: toProjectId('00000000000000000000000005'),
    projectName: 'Projeto',
    createdBy: userId,
    title: `Tarefa ${counter}`,
    createdAt: '2026-01-01T00:00:00Z',
    responsibleParticipationId: toParticipationId('1' + String(counter).padStart(25, '0')),
    responsibleRateCents: 100,
  })
  return setStatus(base, status)
}

describe('estado de WIP por coluna', () => {
  it('sem limite não há estado de limite', () => {
    expect(wipStatus(0, undefined)).toBe('none')
    expect(wipStatus(50, undefined)).toBe('none')
  })

  it('classifica abaixo, no limite e acima do limite', () => {
    expect(wipStatus(2, 3)).toBe('ok')
    expect(wipStatus(3, 3)).toBe('at_limit')
    expect(wipStatus(4, 3)).toBe('over')
  })

  it('conta por coluna e mostra o limite só onde ele existe', () => {
    const tasks = [taskIn('in_progress'), taskIn('in_progress'), taskIn('review'), taskIn('todo')]
    expect(wipColumns(tasks, { in_progress: 1 })).toEqual([
      { status: 'in_progress', count: 2, limit: 1, state: 'over' },
      { status: 'review', count: 1, limit: null, state: 'none' },
    ])
  })

  it('lista só as colunas acima do limite', () => {
    const tasks = [taskIn('in_progress'), taskIn('in_progress'), taskIn('review')]
    expect(overWipColumns(tasks, { in_progress: 1, review: 1 })).toEqual([
      { status: 'in_progress', count: 2, limit: 1 },
    ])
    expect(overWipColumns(tasks, { in_progress: 2 })).toEqual([])
  })
})
