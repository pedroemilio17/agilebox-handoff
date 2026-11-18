import { describe, expect, it } from 'vitest'
import { CEREMONY_KINDS, suggestCeremony } from './ceremonies'
import type { CeremonySprint } from './ceremonies'

const sprint: CeremonySprint = {
  number: 4,
  plannedStart: '2026-11-16',
  plannedEnd: '2026-11-27',
}

describe('suggestCeremony', () => {
  it('sugere a planning no início planejado, com título pela numeração da sprint', () => {
    expect(suggestCeremony(sprint, 'planning')).toEqual({
      ceremony: 'planning',
      title: 'Planning da Sprint 4',
      meetingKind: 'meeting',
      date: '2026-11-16',
      time: '09:00',
    })
  })

  it('sugere a review e a retro no fim planejado, nos tipos de agendamento próprios', () => {
    expect(suggestCeremony(sprint, 'review')).toMatchObject({
      title: 'Review da Sprint 4',
      meetingKind: 'review',
      date: '2026-11-27',
      time: '10:00',
    })
    expect(suggestCeremony(sprint, 'retro')).toMatchObject({
      title: 'Retrospectiva da Sprint 4',
      meetingKind: 'retro',
      date: '2026-11-27',
      time: '11:00',
    })
  })

  it('usa o número da sprint, não o nome livre', () => {
    const renamed = { ...sprint, number: 12 }
    expect(suggestCeremony(renamed, 'planning').title).toBe('Planning da Sprint 12')
  })

  it('a review sai antes da retro no mesmo dia', () => {
    const review = suggestCeremony(sprint, 'review')
    const retro = suggestCeremony(sprint, 'retro')
    expect(review.date).toBe(retro.date)
    expect(review.time < retro.time).toBe(true)
  })

  it('cobre as três cerimônias', () => {
    expect(CEREMONY_KINDS).toEqual(['planning', 'review', 'retro'])
  })

  it('recusa data inválida da sprint', () => {
    expect(() => suggestCeremony({ ...sprint, plannedStart: '16/11/2026' }, 'planning')).toThrow()
  })
})
