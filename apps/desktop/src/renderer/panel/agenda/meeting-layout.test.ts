import { describe, expect, it } from 'vitest'
import type { MeetingDto } from '@agilebox/contract'
import { positionMeetings } from './meeting-layout'
const meeting = (id: string, time: string): MeetingDto => ({
  id,
  time,
  date: '2026-11-02',
  title: id,
  participants: [],
  createdBy: '',
  createdAt: '',
  updatedAt: '',
})
describe('posição de agendamentos', () => {
  it('divide sobrepostos, reaproveita faixas e mantém intervalos encostados separados', () => {
    const input = [
      meeting('a', '09:00'),
      meeting('b', '09:30'),
      meeting('c', '10:00'),
      meeting('d', '12:00'),
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
  it('recorta eventos na borda sem desenhar posições negativas ou além de 18h', () => {
    expect(
      positionMeetings([
        meeting('early', '06:00'),
        meeting('edge', '07:30'),
        meeting('late', '17:30'),
        meeting('after', '18:00'),
      ]).map(({ meeting, top, height }) => [meeting.id, top, height]),
    ).toEqual([
      ['edge', 0, 26],
      ['late', 494, 26],
    ])
  })
})
