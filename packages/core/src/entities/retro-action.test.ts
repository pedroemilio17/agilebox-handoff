import { describe, expect, it } from 'vitest'
import { createRetroAction } from './retro-action'
import type { RetroAction } from './retro-action'
import { ValidationError } from '../shared/errors'
import { toMeetingId, toOrganizationId, toRetroActionId, toUserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'

const orgId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
const userId = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAW')

function action(overrides: Partial<RetroAction> = {}): RetroAction {
  return {
    id: toRetroActionId('01ARZ3NDEKTSV4RRFFQ69G5FB1'),
    organizationId: orgId,
    meetingId: toMeetingId('01ARZ3NDEKTSV4RRFFQ69G5FB2'),
    occurrenceDate: parseDateOnly('2026-11-06'),
    title: '  Revisar prazos  ',
    responsibleId: userId,
    dueDate: parseDateOnly('2026-11-13'),
    done: false,
    doneAt: null,
    createdAt: '2026-11-06T16:00:00.000Z',
    createdBy: userId,
    ...overrides,
  }
}

describe('combinado da retro', () => {
  it('aparra o título e aceita sem responsável e sem prazo', () => {
    const created = createRetroAction(action({ responsibleId: null, dueDate: null }))
    expect(created.title).toBe('Revisar prazos')
    expect(created.responsibleId).toBeNull()
    expect(created.dueDate).toBeNull()
  })

  it('recusa título vazio ou com mais de 200 caracteres', () => {
    expect(() => createRetroAction(action({ title: '   ' }))).toThrow(ValidationError)
    expect(() => createRetroAction(action({ title: 'x'.repeat(201) }))).toThrow(ValidationError)
    expect(createRetroAction(action({ title: 'x'.repeat(200) })).title).toHaveLength(200)
  })

  it('recusa prazo anterior à data da ocorrência', () => {
    expect(() => createRetroAction(action({ dueDate: parseDateOnly('2026-11-05') }))).toThrow(
      'Prazo anterior à data da ocorrência',
    )
    expect(createRetroAction(action({ dueDate: parseDateOnly('2026-11-06') })).dueDate).toBe(
      '2026-11-06',
    )
  })

  it('exige coerência entre concluído e data de conclusão', () => {
    expect(() => createRetroAction(action({ done: true, doneAt: null }))).toThrow(ValidationError)
    expect(() =>
      createRetroAction(action({ done: false, doneAt: '2026-11-07T10:00:00.000Z' })),
    ).toThrow(ValidationError)
  })
})
