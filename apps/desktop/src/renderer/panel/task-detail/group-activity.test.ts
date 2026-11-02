import { describe, expect, it } from 'vitest'
import { makeEvent, USER_ID } from './fixtures'
import { groupActivity } from './group-activity'

describe('agrupamento de atividade', () => {
  it('ordena sem alterar a entrada e preserva cada evento', () => {
    const events = [
      makeEvent({ id: 'old', at: '2026-10-31T10:00:00Z' }),
      makeEvent({ id: 'new', at: '2026-10-31T12:00:00Z' }),
    ]
    const groups = groupActivity(events)
    expect(groups.map((group) => group.map((event) => event.id))).toEqual([['new', 'old']])
    expect(events.map((event) => event.id)).toEqual(['old', 'new'])
  })
  it('não junta eventos separados por outra pessoa, perfil ou dia', () => {
    const events = [
      makeEvent({ id: 'a', at: '2026-10-31T18:00:00Z' }),
      makeEvent({ id: 'b', at: '2026-10-31T17:00:00Z', actorUserId: 'outra' }),
      makeEvent({ id: 'c', at: '2026-10-31T16:00:00Z', actorUserId: USER_ID }),
      makeEvent({ id: 'd', at: '2026-10-31T15:00:00Z', asManager: true }),
      makeEvent({ id: 'e', at: '2026-10-30T15:00:00Z', asManager: true }),
    ]
    expect(groupActivity(events).map((group) => group.length)).toEqual([1, 1, 1, 1, 1])
    expect(groupActivity([])).toEqual([])
  })
})
