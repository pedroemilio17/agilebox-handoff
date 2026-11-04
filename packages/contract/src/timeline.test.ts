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

  it('aceita o evento de mudança de prioridade', () => {
    const event = {
      id: eventId,
      taskId,
      at: '2026-10-31T12:30:00.000Z',
      actorUserId,
      asManager: false,
      type: 'priority_changed',
      text: 'alterou a prioridade de Normal para Alta',
    }
    expect(listTimelineOutputSchema.parse([event])).toEqual([event])
  })

  it('aceita os eventos de bloqueio e desbloqueio', () => {
    const base = {
      id: eventId,
      taskId,
      at: '2026-10-31T12:30:00.000Z',
      actorUserId,
      asManager: true,
    }
    expect(
      listTimelineOutputSchema
        .parse([
          { ...base, type: 'blocked', text: 'bloqueou a tarefa: Aguardando credenciais' },
          { ...base, type: 'unblocked', text: 'desbloqueou a tarefa' },
        ])
        .map((event) => event.type),
    ).toEqual(['blocked', 'unblocked'])
  })
})
