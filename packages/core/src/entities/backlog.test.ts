import { toEventId } from '../shared/ids'
import { describe, expect, it } from 'vitest'
import { ConflictError, ValidationError } from '../shared/errors'
import { toOrganizationId, toParticipationId, toProjectId, toTaskId, toUserId } from '../shared/ids'
import {
  addToBacklog,
  archiveTask,
  createTask,
  isInBacklog,
  pullFromBacklog,
  sendToBacklog,
  setBacklogRank,
  setStatus,
} from './task'
import type { Task } from './task'
import type { Actor } from '../policies/actor'

const id = (n: number) => `0000000000000000000000000${n}`
const creator = toUserId(id(1))

function task(overrides: Partial<Task> = {}): Task {
  return {
    ...createTask({
      id: toTaskId(id(1)),
      organizationId: toOrganizationId(id(1)),
      number: 1,
      projectId: toProjectId(id(1)),
      projectName: 'Projeto',
      createdBy: creator,
      title: 'Tarefa',
      createdAt: '2026-01-01T00:00:00Z',
      responsibleParticipationId: toParticipationId(id(1)),
      responsibleRateCents: 4500,
    }),
    ...overrides,
  }
}

describe('backlog: entidade', () => {
  it('tarefa nova nasce fora do backlog, e isInBacklog separa quadro de backlog', () => {
    expect(task().backlogRank).toBeNull()
    expect(isInBacklog(task())).toBe(false)
    expect(isInBacklog(task({ backlogRank: 1024 }))).toBe(true)
  })

  it('entra no backlog em Planejamento com a posição dada', () => {
    const entered = addToBacklog(task(), 2048)
    expect(entered).toMatchObject({ status: 'planning', backlogRank: 2048 })
  })

  it('criar no backlog recusa tarefa que já começou, já está no backlog ou está arquivada', () => {
    expect(() => addToBacklog(task({ status: 'todo' }), 1024)).toThrow(ConflictError)
    expect(() => addToBacklog(task({ backlogRank: 1024 }), 2048)).toThrow('já está no backlog')
    const archived = archiveTask(task(), creator, '2026-02-01T00:00:00Z')
    expect(() => addToBacklog(archived, 1024)).toThrow('arquivada')
  })

  it('devolve ao backlog tarefa em Planejamento ou A fazer, e o estado vira Planejamento', () => {
    expect(sendToBacklog(setStatus(task(), 'todo'), 1024)).toMatchObject({
      status: 'planning',
      backlogRank: 1024,
    })
    expect(sendToBacklog(task(), 1024)).toMatchObject({ status: 'planning', backlogRank: 1024 })
  })

  it('não devolve ao backlog tarefa em andamento, revisão ou concluída, com mensagem clara', () => {
    for (const status of ['in_progress', 'review', 'done'] as const) {
      const started = setStatus(task(), status)
      expect(() => sendToBacklog(started, 1024)).toThrow(ConflictError)
      expect(() => sendToBacklog(started, 1024)).toThrow('já começou')
    }
  })

  it('não devolve tarefa que já está no backlog nem a arquivada', () => {
    expect(() => sendToBacklog(task({ backlogRank: 1024 }), 2048)).toThrow('já está no backlog')
    const archived = archiveTask(task(), creator, '2026-02-01T00:00:00Z')
    expect(() => sendToBacklog(archived, 1024)).toThrow('arquivada')
  })

  it('puxa para o quadro em A fazer por padrão, ou no estado pedido, e tira a posição', () => {
    const onBacklog = task({ backlogRank: 1024 })
    expect(pullFromBacklog(onBacklog)).toMatchObject({ status: 'todo', backlogRank: null })
    expect(pullFromBacklog(onBacklog, 'in_progress')).toMatchObject({
      status: 'in_progress',
      backlogRank: null,
    })
  })

  it('puxar para Planejamento é recusado: Planejamento não é coluna de saída', () => {
    expect(() => pullFromBacklog(task({ backlogRank: 1024 }), 'planning')).toThrow(ValidationError)
  })

  it('puxar tarefa que não está no backlog é conflito; puxar arquivada também', () => {
    expect(() => pullFromBacklog(task())).toThrow('não está no backlog')
    const archived = archiveTask(task({ backlogRank: 1024 }), creator, '2026-02-01T00:00:00Z')
    expect(() => pullFromBacklog(archived)).toThrow('arquivada')
  })

  it('setBacklogRank só mexe em item de backlog e recusa arquivada', () => {
    expect(setBacklogRank(task({ backlogRank: 1024 }), 4096).backlogRank).toBe(4096)
    expect(() => setBacklogRank(task(), 4096)).toThrow('não está no backlog')
  })
})

import { describeEvent } from '../rules/timeline'
import type { TimelineEvent } from './timeline-event'
import { showsOnBoard } from '../rules/backlog'

describe('backlog: textos da linha do tempo e visibilidade', () => {
  const names = {
    organizationId: toOrganizationId(id(1)),
    user: () => 'Ana',
    contributor: () => 'Entidade',
  }
  const viewer: Actor = {
    userId: creator,
    organizationId: toOrganizationId(id(1)),
    role: 'collaborator',
  }
  const base = {
    id: toEventId(id(9)),
    taskId: toTaskId(id(1)),
    at: '2026-01-01T00:00:00Z',
    actorUserId: creator,
    asManager: false,
  }
  const text = (event: TimelineEvent) => describeEvent(event, viewer, names)

  it('descreve cada evento de backlog em pt-BR', () => {
    expect(text({ ...base, type: 'task_added_to_backlog', payload: {} })).toBe(
      'adicionou a tarefa ao backlog',
    )
    expect(text({ ...base, type: 'task_sent_to_backlog', payload: {} })).toBe(
      'devolveu a tarefa ao backlog',
    )
    expect(text({ ...base, type: 'task_pulled_from_backlog', payload: { status: 'todo' } })).toBe(
      'puxou a tarefa do backlog para A fazer',
    )
    expect(text({ ...base, type: 'task_reordered', payload: { position: 3 } })).toBe(
      'reordenou a tarefa no backlog (posição 3)',
    )
  })

  it('só o item de backlog sai do quadro: showsOnBoard é o oposto de estar no backlog', () => {
    expect(showsOnBoard({ backlogRank: null })).toBe(true)
    expect(showsOnBoard({ backlogRank: 1024 })).toBe(false)
  })
})
