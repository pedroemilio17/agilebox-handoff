import { describe, expect, it } from 'vitest'
import { createTask } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import type { TimelineEventDraft } from './timeline'
import { createTimelineEvent } from '../entities/timeline-event'
import type { Actor } from '../policies/actor'
import {
  toAcceptanceCriterionId,
  toEventId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import { describeEvent, diffTask } from './timeline'

const id = (n: number) => `0000000000000000000000000${n}`
const org = toOrganizationId(id(1))
const ana = toUserId(id(2))
const names = {
  organizationId: org,
  user: () => 'Ana',
  contributor: () => 'Cliente',
}
const viewer: Actor = { userId: ana, organizationId: org, role: 'manager' }
const criterionId = toAcceptanceCriterionId(id(6))

function event(draft: TimelineEventDraft): TimelineEvent {
  return createTimelineEvent({
    ...draft,
    id: toEventId(id(5)),
    taskId: toTaskId(id(1)),
    at: '2026-01-02T10:00:00.000Z',
    actorUserId: ana,
    asManager: false,
  })
}

const text = (draft: TimelineEventDraft) => describeEvent(event(draft), viewer, names)

describe('textos da linha do tempo dos critérios (pt-BR)', () => {
  it.each([
    [
      { type: 'acceptance_criterion_added', payload: { criterionId, text: 'Abre sem erro' } },
      'adicionou o critério: Abre sem erro',
    ],
    [
      { type: 'acceptance_criterion_removed', payload: { criterionId, text: 'Abre sem erro' } },
      'removeu o critério: Abre sem erro',
    ],
    [
      { type: 'acceptance_criterion_done', payload: { criterionId, text: 'Abre sem erro' } },
      'marcou o critério como atendido: Abre sem erro',
    ],
    [
      { type: 'acceptance_criterion_reopened', payload: { criterionId, text: 'Abre sem erro' } },
      'desmarcou o critério: Abre sem erro',
    ],
    [
      {
        type: 'acceptance_criterion_renamed',
        payload: { criterionId, before: 'Abre', after: 'Abre sem erro' },
      },
      'renomeou o critério de "Abre" para "Abre sem erro"',
    ],
    [
      {
        type: 'acceptance_criterion_moved',
        payload: { criterionId, text: 'Abre sem erro', before: 0, after: 1 },
      },
      'reordenou o critério "Abre sem erro" para a posição 2',
    ],
  ] as const)('descreve %#', (draft, expected) => {
    expect(text(draft as TimelineEventDraft)).toBe(expected)
  })
})

describe('textos e diff da estimativa', () => {
  it('estimativa de nada para 2,5 h e de volta', () => {
    expect(text({ type: 'estimate_changed', payload: { before: null, after: 250 } })).toBe(
      'alterou a estimativa de sem estimativa para 2,5 h',
    )
    expect(text({ type: 'estimate_changed', payload: { before: 250, after: null } })).toBe(
      'alterou a estimativa de 2,5 h para sem estimativa',
    )
  })

  it('o diff da tarefa gera estimate_changed só quando a estimativa muda', () => {
    const before = createTask({
      id: toTaskId(id(1)),
      organizationId: org,
      number: 1,
      projectId: toProjectId(id(1)),
      projectName: 'P',
      createdBy: ana,
      title: 'T',
      createdAt: '2026-01-01T00:00:00.000Z',
      responsibleParticipationId: toParticipationId(id(3)),
      responsibleRateCents: 4500,
    })
    const after = { ...before, estimatedHoursHundredths: 300 }
    expect(diffTask(before, after)).toEqual([
      { type: 'estimate_changed', payload: { before: null, after: 300 } },
    ])
    expect(diffTask(after, after)).toEqual([])
  })
})
