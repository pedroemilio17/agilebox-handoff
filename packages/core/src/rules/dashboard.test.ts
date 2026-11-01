import { describe, expect, it } from 'vitest'
import { createTask, setStatus } from '../entities/task'
import { toOrganizationId, toParticipationId, toProjectId, toTaskId, toUserId } from '../shared/ids'
import { collaboratorStats, statusPercentages } from './dashboard'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')
const otherId = toUserId('00000000000000000000000003')
const task = createTask({
  id: toTaskId('00000000000000000000000004'),
  organizationId,
  projectId: toProjectId('00000000000000000000000005'),
  projectName: 'Projeto',
  createdBy: userId,
  title: 'Tarefa',
  createdAt: '2026-01-01T00:00:00Z',
  responsibleParticipationId: toParticipationId('00000000000000000000000006'),
  responsibleRateCents: 100,
})

describe('dashboard', () => {
  it('retorna zeros para nenhuma tarefa e 100 para uma tarefa', () => {
    expect(statusPercentages([])).toEqual({
      planning: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    })
    expect(statusPercentages([task])).toEqual({
      planning: 100,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    })
  })

  it('distribui a sobra pelo maior resto, com desempate na ordem dos estados', () => {
    expect(statusPercentages([task, setStatus(task, 'todo'), setStatus(task, 'done')])).toEqual({
      planning: 34,
      todo: 33,
      in_progress: 0,
      review: 0,
      done: 33,
    })
    expect(
      statusPercentages([
        task,
        task,
        setStatus(task, 'todo'),
        setStatus(task, 'done'),
        setStatus(task, 'done'),
        setStatus(task, 'done'),
      ]),
    ).toEqual({ planning: 33, todo: 17, in_progress: 0, review: 0, done: 50 })
  })

  it('conta criação e envolvimento de usuário uma vez, isolando organizações e entidades', () => {
    const supported = { ...setStatus(task, 'done'), createdBy: otherId }
    const creatorOnly = { ...task, participations: [] }
    const unrelated = { ...task, createdBy: otherId, participations: [] }
    const otherOrg = { ...task, organizationId: toOrganizationId('00000000000000000000000007') }
    expect(
      collaboratorStats(
        [task, supported, creatorOnly, unrelated, otherOrg],
        organizationId,
        userId,
      ),
    ).toEqual({
      taskCount: 3,
      distribution: { planning: 67, todo: 0, in_progress: 0, review: 0, done: 33 },
      completedPercentage: 33,
    })
    expect(collaboratorStats([], organizationId, userId)).toEqual({
      taskCount: 0,
      distribution: { planning: 0, todo: 0, in_progress: 0, review: 0, done: 0 },
      completedPercentage: 0,
    })
  })
})
