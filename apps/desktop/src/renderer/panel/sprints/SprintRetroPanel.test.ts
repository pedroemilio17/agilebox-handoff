import { describe, expect, it } from 'vitest'
import type { MeetingOccurrenceDto } from '@agilebox/contract'
import { pickSprintRetro } from './SprintRetroPanel'

const sprint = { plannedStart: '2026-11-09', plannedEnd: '2026-11-20' }

function meeting(kind: string, occurrenceDate: string): MeetingOccurrenceDto {
  return {
    kind,
    occurrenceDate,
    seriesId: `series-${kind}-${occurrenceDate}`,
  } as MeetingOccurrenceDto
}

describe('pickSprintRetro', () => {
  it('escolhe a retro mais recente dentro do período da sprint', () => {
    const picked = pickSprintRetro(
      [
        meeting('retro', '2026-11-13'),
        meeting('retro', '2026-11-20'),
        meeting('review', '2026-11-19'),
        meeting('retro', '2026-11-25'),
      ],
      sprint,
    )
    expect(picked?.occurrenceDate).toBe('2026-11-20')
  })

  it('sem retro no período, devolve nulo', () => {
    expect(pickSprintRetro([meeting('planning', '2026-11-09')], sprint)).toBeNull()
  })
})
