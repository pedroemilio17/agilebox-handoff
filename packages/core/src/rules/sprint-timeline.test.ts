import { describe, expect, it } from 'vitest'
import type { SprintEvent } from '../entities/sprint-event'
import type { Actor } from '../policies/actor'
import { toEventId, toOrganizationId, toSprintId, toTaskId, toUserId } from '../shared/ids'
import { describeEvent } from './timeline'
import type { TaskSprintTimelineEvent } from '../entities/timeline-event'
import { describeSprintEvent } from './sprint-timeline'

const id = (n: number) => String(n).padStart(26, '0')
const org = toOrganizationId(id(1))
const names = { organizationId: org, user: () => 'Ana', contributor: () => 'X' }
const collaborator: Actor = { userId: toUserId(id(2)), organizationId: org, role: 'collaborator' }

function event(
  type: 'task_added_to_sprint' | 'task_removed_from_sprint',
  asManager = false,
): TaskSprintTimelineEvent {
  return {
    id: toEventId(id(3)),
    taskId: toTaskId(id(4)),
    at: '2026-03-03T09:00:00.000Z',
    actorUserId: toUserId(id(2)),
    asManager,
    type,
    payload: { sprintId: toSprintId(id(5)), sprintNumber: 4 },
  }
}

describe('linha do tempo: escopo da sprint na tarefa', () => {
  it('entrar na sprint e sair dela aparecem com o número da sprint, em pt-BR', () => {
    expect(describeEvent(event('task_added_to_sprint'), collaborator, names)).toBe(
      'adicionou a tarefa à Sprint 4',
    )
    expect(describeEvent(event('task_removed_from_sprint'), collaborator, names)).toBe(
      'removeu a tarefa da Sprint 4',
    )
  })

  it('o evento guarda a marca de gestor como as demais edições', () => {
    expect(event('task_added_to_sprint', true).asManager).toBe(true)
  })
})

describe('eventos da própria sprint (estrutura para o M4.2)', () => {
  const base = {
    id: toEventId(id(6)),
    organizationId: org,
    sprintId: toSprintId(id(5)),
    sprintNumber: 4,
    at: '2026-03-02T09:00:00.000Z',
    actorUserId: toUserId(id(2)),
    asManager: true,
  }

  it('descreve início e encerramento nas duas políticas, em pt-BR', () => {
    const started: SprintEvent = { ...base, type: 'sprint_started', payload: {} }
    expect(describeSprintEvent(started)).toBe('iniciou a Sprint 4')
    const closed: SprintEvent = {
      ...base,
      type: 'sprint_closed',
      payload: { closePolicy: 'return_to_backlog', movedCount: 2 },
    }
    expect(describeSprintEvent(closed)).toBe(
      'encerrou a Sprint 4 e devolveu os itens abertos ao backlog',
    )
    const carried: SprintEvent = {
      ...base,
      type: 'sprint_closed',
      payload: { closePolicy: 'carry_over', movedCount: 1 },
    }
    expect(describeSprintEvent(carried)).toBe(
      'encerrou a Sprint 4 e levou os itens abertos para a sprint seguinte',
    )
  })
})
