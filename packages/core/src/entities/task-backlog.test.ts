import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toOrganizationId, toParticipationId, toProjectId, toTaskId, toUserId } from '../shared/ids'
import { createTask, sendToBacklog, setBacklogRank, takeToBoard } from './task'

const id = (n: number) => String(n).padStart(26, '0')
const newTask = () =>
  createTask({
    id: toTaskId(id(1)),
    organizationId: toOrganizationId(id(1)),
    projectId: toProjectId(id(1)),
    projectName: 'Projeto',
    createdBy: toUserId(id(1)),
    title: 'Tarefa',
    createdAt: '2026-01-01T00:00:00Z',
    responsibleParticipationId: toParticipationId(id(1)),
    responsibleRateCents: 4500,
  })

describe('tarefa e backlog', () => {
  it('nova tarefa nasce no quadro, fora do backlog', () => {
    expect(newTask()).toMatchObject({ backlogRank: null, onBoard: true, status: 'planning' })
  })

  it('manda ao backlog na posição dada e tira do quadro, sem mudar o estado', () => {
    const task = { ...newTask(), status: 'in_progress' as const }
    const queued = sendToBacklog(task, 3)
    expect(queued).toMatchObject({ backlogRank: 3, onBoard: false, status: 'in_progress' })
    expect(task.backlogRank).toBeNull()
    expect(() => sendToBacklog(task, 0)).toThrow(ValidationError)
  })

  it('muda a posição só de tarefa que já está no backlog', () => {
    const queued = sendToBacklog(newTask(), 2)
    expect(setBacklogRank(queued, 1)).toMatchObject({ backlogRank: 1, onBoard: false })
    expect(() => setBacklogRank(newTask(), 1)).toThrow(ValidationError)
    expect(() => setBacklogRank(queued, -1)).toThrow(ValidationError)
  })

  it('leva ao quadro: entra em Planejamento, sai do backlog e volta a ficar no quadro', () => {
    const queued = sendToBacklog({ ...newTask(), status: 'todo' }, 4)
    expect(takeToBoard(queued)).toMatchObject({
      backlogRank: null,
      onBoard: true,
      status: 'planning',
    })
  })

  it('levar ao quadro recusa tarefa que não está no backlog', () => {
    expect(() => takeToBoard(newTask())).toThrow(ValidationError)
  })

  it('não altera a tarefa de entrada', () => {
    const task = newTask()
    sendToBacklog(task, 1)
    takeToBoard(sendToBacklog(task, 1))
    expect(task).toMatchObject({ backlogRank: null, onBoard: true, status: 'planning' })
  })
})
