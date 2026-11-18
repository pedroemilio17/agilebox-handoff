import { describe, expect, it } from 'vitest'
import { createTimelineEvent } from '../entities/timeline-event'
import { toDeliverableId, toEventId, toOrganizationId, toTaskId, toUserId } from '../shared/ids'
import type { Actor } from '../policies/actor'
import { describeEvent, deliverableChangeDraft } from './timeline'

const ulid = (n: number) => String(n).padStart(26, '0')
const org = toOrganizationId(ulid(1))
const names = {
  organizationId: org,
  user: () => 'Ana',
  contributor: () => 'Fornecedor',
}
const manager: Actor = { userId: toUserId(ulid(2)), organizationId: org, role: 'manager' }
const deliverable = { id: toDeliverableId(ulid(7)), title: 'Infra' }
const other = { id: toDeliverableId(ulid(8)), title: 'Acesso' }

describe('linha do tempo: mudança de entrega', () => {
  it('não gera evento quando a entrega não muda', () => {
    expect(deliverableChangeDraft(null, null)).toBeNull()
    expect(deliverableChangeDraft(deliverable, deliverable)).toBeNull()
  })

  it('ligar, trocar e desligar geram o evento com antes e depois (e os títulos)', () => {
    expect(deliverableChangeDraft(null, deliverable)).toEqual({
      type: 'deliverable_changed',
      payload: { before: null, after: deliverable.id, beforeTitle: null, afterTitle: 'Infra' },
    })
    expect(deliverableChangeDraft(deliverable, other)).toEqual({
      type: 'deliverable_changed',
      payload: {
        before: deliverable.id,
        after: other.id,
        beforeTitle: 'Infra',
        afterTitle: 'Acesso',
      },
    })
    expect(deliverableChangeDraft(deliverable, null)).toEqual({
      type: 'deliverable_changed',
      payload: { before: deliverable.id, after: null, beforeTitle: 'Infra', afterTitle: null },
    })
  })

  it('o texto da linha do tempo diz ligar, trocar ou remover, com o nome da entrega', () => {
    const at = '2026-03-01T10:00:00.000Z'
    const event = (draft: NonNullable<ReturnType<typeof deliverableChangeDraft>>) =>
      createTimelineEvent({
        ...draft,
        id: toEventId(ulid(9)),
        taskId: toTaskId(ulid(6)),
        at,
        actorUserId: manager.userId,
        asManager: true,
      })
    const text = (draft: NonNullable<ReturnType<typeof deliverableChangeDraft>>) =>
      describeEvent(event(draft), manager, names)

    expect(text(deliverableChangeDraft(null, deliverable)!)).toBe(
      'ligou a tarefa à entrega "Infra"',
    )
    expect(text(deliverableChangeDraft(deliverable, other)!)).toBe(
      'mudou a tarefa da entrega "Infra" para "Acesso"',
    )
    expect(text(deliverableChangeDraft(deliverable, null)!)).toBe(
      'removeu a tarefa da entrega "Infra"',
    )
  })
})
