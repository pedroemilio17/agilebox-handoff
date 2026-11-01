import { describe, expect, it } from 'vitest'
import {
  createMeetingInputSchema,
  dashboardDtoSchema,
  deleteMeetingInputSchema,
  listMeetingsInputSchema,
  meetingDtoSchema,
  updateMeetingInputSchema,
} from './index'

const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const meetingId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

describe('schemas de dashboard e agenda', () => {
  it('valida distribuição por estado e estatísticas de colaboradores', () => {
    const dashboard = {
      distribution: { planning: 20, todo: 20, in_progress: 20, review: 20, done: 20 },
      collaborators: [
        {
          user: { id: userId, name: 'Ana Lima', initials: 'AL', role: 'collaborator' },
          taskCount: 5,
          distribution: { planning: 20, todo: 20, in_progress: 20, review: 20, done: 20 },
          completedPercentage: 20,
        },
      ],
    }
    expect(dashboardDtoSchema.parse(dashboard)).toEqual(dashboard)
    expect(
      dashboardDtoSchema.safeParse({
        ...dashboard,
        distribution: { planning: 20, todo: 20, in_progress: 20, review: 20, done: 0 },
      }).success,
    ).toBe(false)
  })

  it('valida mês, horário local e participantes de usuário nos agendamentos', () => {
    const meeting = {
      id: meetingId,
      title: 'Alinhamento semanal',
      date: '2026-11-02',
      time: '09:00',
      participants: [userId],
      createdBy: userId,
      createdAt: '2026-10-31T12:00:00.000Z',
      updatedAt: '2026-10-31T12:00:00.000Z',
    }
    expect(listMeetingsInputSchema.parse({ month: '2026-11' })).toEqual({ month: '2026-11' })
    expect(meetingDtoSchema.parse(meeting)).toEqual(meeting)
    expect(
      createMeetingInputSchema.parse({
        title: ' Alinhamento semanal ',
        date: '2026-11-02',
        time: '09:00',
        participants: [userId],
      }),
    ).toEqual({
      title: 'Alinhamento semanal',
      date: '2026-11-02',
      time: '09:00',
      participants: [userId],
    })
    expect(updateMeetingInputSchema.parse({ meetingId, changes: { time: '10:30' } })).toEqual({
      meetingId,
      changes: { time: '10:30' },
    })
    expect(deleteMeetingInputSchema.parse({ meetingId })).toEqual({ meetingId })
  })

  it('rejeita mês, data, hora, lista de participantes e atualização inválidos', () => {
    expect(listMeetingsInputSchema.safeParse({ month: '2026-13' }).success).toBe(false)
    expect(
      createMeetingInputSchema.safeParse({
        title: 'Reunião',
        date: '2026-02-30',
        time: '25:00',
        participants: ['usuario'],
      }).success,
    ).toBe(false)
    expect(updateMeetingInputSchema.safeParse({ meetingId, changes: {} }).success).toBe(false)
  })
})
