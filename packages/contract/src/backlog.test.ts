import { describe, expect, it } from 'vitest'
import { API_CHANNELS } from './channels'
import { API_SCHEMA_REGISTRY } from './api'
import {
  addToBacklogInputSchema,
  listBacklogInputSchema,
  pullFromBacklogInputSchema,
  reorderBacklogInputSchema,
  sendToBacklogInputSchema,
} from './backlog'
import { taskDtoSchema } from './tasks'
import { timelineEventTypeSchema } from './timeline'

const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const otherId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const projectId = '01ARZ3NDEKTSV4RRFFQ69G5FAX'

describe('schemas do backlog', () => {
  it('registra os canais de backlog com schemas de entrada e saída', () => {
    for (const channel of [
      'backlog.list',
      'backlog.add',
      'backlog.reorder',
      'backlog.pull',
      'backlog.sendBack',
    ] as const) {
      expect(API_CHANNELS).toContain(channel)
      expect(API_SCHEMA_REGISTRY[channel]).toBeDefined()
    }
  })

  it('lista exige o projeto; includeArchived é opcional', () => {
    expect(listBacklogInputSchema.parse({ projectId })).toEqual({ projectId })
    expect(() => listBacklogInputSchema.parse({})).toThrow()
    expect(listBacklogInputSchema.parse({ projectId, includeArchived: true })).toEqual({
      projectId,
      includeArchived: true,
    })
  })

  it('criar no backlog aceita os campos de criação, sem estado nem definição de pronto', () => {
    expect(addToBacklogInputSchema.parse({ projectId, title: 'Nova' })).toEqual({
      projectId,
      title: 'Nova',
    })
    expect(
      addToBacklogInputSchema.parse({ projectId, title: 'Nova', status: 'todo' }),
    ).not.toHaveProperty('status')
  })

  it('reordenar pede topo ou fim, ou um vizinho, e não os dois modos juntos', () => {
    expect(reorderBacklogInputSchema.safeParse({ taskId, position: 'top' }).success).toBe(true)
    expect(reorderBacklogInputSchema.safeParse({ taskId, position: 'end' }).success).toBe(true)
    expect(reorderBacklogInputSchema.safeParse({ taskId, afterId: otherId }).success).toBe(true)
    expect(reorderBacklogInputSchema.safeParse({ taskId, beforeId: otherId }).success).toBe(true)
    expect(
      reorderBacklogInputSchema.safeParse({ taskId, afterId: null, beforeId: otherId }).success,
    ).toBe(true)
    expect(reorderBacklogInputSchema.safeParse({ taskId }).success).toBe(false)
    expect(
      reorderBacklogInputSchema.safeParse({ taskId, position: 'top', afterId: otherId }).success,
    ).toBe(false)
    expect(reorderBacklogInputSchema.safeParse({ taskId: 'x', position: 'top' }).success).toBe(
      false,
    )
  })

  it('puxar aceita só colunas do quadro (Planejamento não é saída) e sem estado vai para A fazer', () => {
    expect(pullFromBacklogInputSchema.parse({ taskId })).toEqual({ taskId })
    expect(pullFromBacklogInputSchema.parse({ taskId, status: 'review' })).toEqual({
      taskId,
      status: 'review',
    })
    expect(() => pullFromBacklogInputSchema.parse({ taskId, status: 'planning' })).toThrow()
    expect(() => pullFromBacklogInputSchema.parse({ taskId, status: 'inventado' })).toThrow()
  })

  it('devolver ao backlog pede só o id', () => {
    expect(sendToBacklogInputSchema.parse({ taskId })).toEqual({ taskId })
    expect(() => sendToBacklogInputSchema.parse({ taskId: '' })).toThrow()
  })

  it('a tarefa devolvida traz backlogRank e inBacklog, e respostas antigas continuam válidas', () => {
    const base = {
      id: taskId,
      number: 1,
      key: 'AB-1',
      projectId,
      projectName: 'Projeto',
      title: 'Tarefa',
      description: '',
      status: 'planning',
      priority: 'normal',
      blockedReason: null,
      blockedAt: null,
      deadline: null,
      ticketId: null,
      ticketUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      checklistProgress: { done: 0, total: 0, percent: 0 },
      commentCount: 0,
    }
    expect(taskDtoSchema.safeParse({ ...base, backlogRank: 1024, inBacklog: true }).success).toBe(
      true,
    )
    expect(taskDtoSchema.safeParse({ ...base, backlogRank: null, inBacklog: false }).success).toBe(
      true,
    )
    expect(taskDtoSchema.safeParse(base).success).toBe(true)
  })

  it('a linha do tempo conhece os eventos de backlog', () => {
    for (const type of [
      'task_added_to_backlog',
      'task_pulled_from_backlog',
      'task_sent_to_backlog',
      'task_reordered',
    ] as const) {
      expect(timelineEventTypeSchema.parse(type)).toBe(type)
    }
  })
})
