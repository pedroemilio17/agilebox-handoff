import { describe, expect, it } from 'vitest'
import { listTimelineInputSchema, listTimelineOutputSchema } from './timeline'

const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const eventId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const actorUserId = '01ARZ3NDEKTSV4RRFFQ69G5FAX'

describe('schemas da linha do tempo', () => {
  it('aceita consulta e evento com texto pronto para o ator', () => {
    const event = {
      id: eventId,
      taskId,
      at: '2026-10-31T12:30:00.000Z',
      actorUserId,
      asManager: true,
      type: 'status_changed',
      text: 'Gestor moveu de Desenvolvendo para Revisar',
    }
    expect(listTimelineInputSchema.parse({ taskId })).toEqual({ taskId })
    expect(listTimelineOutputSchema.parse([event])).toEqual([event])
  })

  it('aceita os eventos de backlog (levar ao quadro e devolver ao backlog)', () => {
    for (const type of ['moved_to_board', 'sent_to_backlog']) {
      const event = {
        id: eventId,
        taskId,
        at: '2026-10-31T12:30:00.000Z',
        actorUserId,
        asManager: false,
        type,
        text: 'levou a tarefa ao quadro',
      }
      expect(listTimelineOutputSchema.parse([event])).toEqual([event])
    }
  })

  it('rejeita ID inválido, tipo desconhecido e data inválida', () => {
    expect(listTimelineInputSchema.safeParse({ taskId: 'tarefa-1' }).success).toBe(false)
    expect(
      listTimelineOutputSchema.safeParse([
        {
          id: eventId,
          taskId,
          at: 'ontem',
          actorUserId,
          asManager: false,
          type: 'unknown',
          text: 'Alterou tarefa',
        },
      ]).success,
    ).toBe(false)
  })
})
