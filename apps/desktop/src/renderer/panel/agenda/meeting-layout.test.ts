import { describe, expect, it } from 'vitest'
import type { MeetingOccurrenceDto } from '@agilebox/contract'
import { positionMeetings } from './meeting-layout'

const meeting = (
  id: string,
  time: string,
  occurrenceEndTime = `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}${time.slice(2)}`,
  occurrenceDate = '2026-11-02',
): MeetingOccurrenceDto => ({
  id,
  title: id,
  date: '2026-11-02',
  time,
  endTime: null,
  kind: 'meeting',
  recurrence: 'none',
  recurrenceUntil: null,
  participants: [],
  createdBy: '',
  createdAt: '',
  updatedAt: '',
  seriesId: id,
  occurrenceDate,
  occurrenceIndex: 0,
  occurrenceEndTime,
})

describe('posição de agendamentos', () => {
  it('usa a hora de fim: 1 h = 52 px, e sem fim vale 1 h (D6)', () => {
    expect(
      positionMeetings([
        meeting('curta', '09:00', '09:30'),
        meeting('longa', '10:00', '12:30'),
      ]).map(({ meeting, top, height }) => [meeting.id, top, height]),
    ).toEqual([
      ['curta', 52, 26],
      ['longa', 104, 130],
    ])
    expect(positionMeetings([meeting('sem-fim', '09:30', '10:30')])[0]).toMatchObject({
      top: 78,
      height: 52,
    })
  })

  it('divide sobrepostos pelo intervalo real e mantém intervalos encostados separados', () => {
    const input = [
      meeting('a', '09:00', '10:00'),
      meeting('b', '09:30', '10:30'),
      meeting('c', '10:00', '11:00'),
      meeting('d', '12:00', '13:00'),
    ]
    expect(
      positionMeetings(input).map(({ meeting, lane, lanes }) => [meeting.id, lane, lanes]),
    ).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 0, 2],
      ['d', 0, 1],
    ])
    expect(input.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('não mistura ocorrências de séries diferentes com o mesmo horário', () => {
    const positioned = positionMeetings([
      meeting('serie-1', '09:00', '10:00', '2026-11-02'),
      meeting('serie-1', '09:00', '10:00', '2026-11-09'),
    ])
    expect(positioned.map(({ meeting }) => meeting.occurrenceDate)).toEqual([
      '2026-11-02',
      '2026-11-09',
    ])
  })

  it('recorta eventos na borda sem desenhar posições negativas ou além de 18h', () => {
    expect(
      positionMeetings([
        meeting('early', '06:00', '07:00'),
        meeting('edge', '07:30', '08:30'),
        meeting('late', '17:30', '18:30'),
        meeting('after', '18:00', '19:00'),
      ]).map(({ meeting, top, height }) => [meeting.id, top, height]),
    ).toEqual([
      ['edge', 0, 26],
      ['late', 494, 26],
    ])
  })
})
