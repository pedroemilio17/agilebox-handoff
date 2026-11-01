import { describe, expect, it } from 'vitest'
import {
  addParticipationInputSchema,
  participationSummaryDtoSchema,
  removeParticipationInputSchema,
  setParticipationHoursInputSchema,
  setParticipationRateInputSchema,
} from './participations'

const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const participationId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAX'
const contributorId = '01ARZ3NDEKTSV4RRFFQ69G5FAY'

describe('schemas de envolvimentos', () => {
  it('aceita participante discriminado como usuário ou entidade', () => {
    expect(
      addParticipationInputSchema.parse({
        taskId,
        participant: { kind: 'user', userId },
        role: 'responsible',
      }),
    ).toEqual({ taskId, participant: { kind: 'user', userId }, role: 'responsible' })
    expect(
      addParticipationInputSchema.parse({
        taskId,
        participant: { kind: 'contributor', contributorId },
        role: 'support',
      }),
    ).toEqual({
      taskId,
      participant: { kind: 'contributor', contributorId },
      role: 'support',
    })
  })

  it('rejeita IDs inválidos, discriminador desconhecido e entidade responsável', () => {
    expect(
      addParticipationInputSchema.safeParse({
        taskId,
        participant: { kind: 'user', userId: 'pessoa-1' },
        role: 'support',
      }).success,
    ).toBe(false)
    expect(
      addParticipationInputSchema.safeParse({
        taskId,
        participant: { kind: 'contributor', contributorId },
        role: 'responsible',
      }).success,
    ).toBe(false)
    expect(
      addParticipationInputSchema.safeParse({
        taskId,
        participant: { kind: 'organization', userId },
        role: 'support',
      }).success,
    ).toBe(false)
  })

  it('aceita horas com vírgula e rejeita vazio ou negativo', () => {
    expect(
      setParticipationHoursInputSchema.parse({ taskId, participationId, hours: '1,5' }),
    ).toEqual({
      taskId,
      participationId,
      hours: '1,5',
    })
    expect(
      setParticipationHoursInputSchema.safeParse({ taskId, participationId, hours: '' }).success,
    ).toBe(false)
    expect(
      setParticipationHoursInputSchema.safeParse({ taskId, participationId, hours: '-1,5' })
        .success,
    ).toBe(false)
  })

  it('aceita setter de valor em centavos e rejeita valor inválido', () => {
    expect(
      setParticipationRateInputSchema.parse({ taskId, participationId, rateCents: 4550 }),
    ).toEqual({
      taskId,
      participationId,
      rateCents: 4550,
    })
    expect(
      setParticipationRateInputSchema.safeParse({ taskId, participationId, rateCents: 0 }).success,
    ).toBe(false)
  })

  it('aceita remoção e rejeita IDs inválidos', () => {
    expect(removeParticipationInputSchema.parse({ taskId, participationId })).toEqual({
      taskId,
      participationId,
    })
    expect(
      removeParticipationInputSchema.safeParse({ taskId, participationId: 'envolvimento-1' })
        .success,
    ).toBe(false)
  })

  it('aceita DTO de envolvimento sem revelar valor/hora quando não visível', () => {
    const participation = {
      id: participationId,
      participant: { kind: 'user', userId },
      participantName: 'Ana Lima',
      role: 'support',
      hours: 1.5,
      rate: null,
    }
    expect(participationSummaryDtoSchema.parse(participation)).toEqual(participation)
  })
})
