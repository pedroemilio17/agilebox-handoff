import { describe, expect, it } from 'vitest'
import { createTask } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import {
  toEventId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import { describeEvent, diffTask } from './timeline'

const id = (n: number) => `0000000000000000000000000${n}`
const organizationId = toOrganizationId(id(1))
const userId = toUserId(id(1))
const other = toUserId(id(2))
const participant = { kind: 'user' as const, userId: other }
const task = createTask({
  id: toTaskId(id(1)),
  organizationId,
  number: 1,
  projectId: toProjectId(id(1)),
  projectName: 'Projeto',
  createdBy: userId,
  title: 'Título',
  createdAt: '2026-01-01',
  responsibleParticipationId: toParticipationId(id(1)),
  responsibleRateCents: 4500,
})
const support = {
  id: toParticipationId(id(2)),
  taskId: task.id,
  participant,
  role: 'support' as const,
  hoursHundredths: 100,
  rateCents: 5000,
  addedAt: '2026-01-01',
}
const viewer = { organizationId, userId, role: 'collaborator' as const }
const names = {
  organizationId,
  user: (id: typeof userId) => (id === userId ? 'Ana' : 'Bia'),
  contributor: () => 'Entidade',
}
const base = {
  id: toEventId(id(1)),
  taskId: task.id,
  at: '2026-01-01',
  actorUserId: userId,
  asManager: false,
}

describe('linha do tempo', () => {
  it('descreve a confirmação sem inventar uma mudança de estado', () => {
    expect(describeEvent({ ...base, type: 'progress_confirmed', payload: {} }, viewer, names)).toBe(
      'confirmou que a tarefa segue em andamento',
    )
  })

  it('gera mudanças de campos e envolvimentos, sem alterações espúrias', () => {
    const before = {
      ...task,
      status: 'todo' as const,
      participations: [...task.participations, support],
    }
    const after = {
      ...before,
      title: 'Novo',
      description: 'Texto',
      status: 'in_progress' as const,
      priority: 'high' as const,
      deadline: parseDateOnly('2026-02-01'),
      ticket: { id: 42 },
      participations: [
        { ...task.participations[0]!, role: 'support' as const },
        { ...support, role: 'responsible' as const, hoursHundredths: 200, rateCents: 6000 },
      ],
    }
    expect(diffTask(before, before)).toEqual([])
    expect(diffTask(before, after).map((event) => event.type)).toEqual([
      'status_changed',
      'priority_changed',
      'deadline_changed',
      'renamed',
      'description_edited',
      'responsible_changed',
      'ticket_changed',
      'hours_changed',
      'rate_changed',
    ])
    expect(
      diffTask(task, { ...task, participations: [...task.participations, support] }),
    ).toMatchObject([{ type: 'participant_added', payload: { participant, role: 'support' } }])
    expect(diffTask(before, task)).toContainEqual({
      type: 'participant_removed',
      payload: { participant, role: 'support' },
    })
    expect(diffTask({ ...task, ticket: { id: 42 } }, { ...task, ticket: { id: 42 } })).toEqual([])
  })
  it('descreve todos os tipos e protege valores de terceiros', () => {
    const events: TimelineEvent[] = [
      { ...base, type: 'task_created', payload: {} },
      { ...base, type: 'status_changed', payload: { before: 'todo', after: 'in_progress' } },
      {
        ...base,
        type: 'deadline_changed',
        payload: { before: null, after: parseDateOnly('2026-02-01') },
      },
      { ...base, type: 'renamed', payload: { before: 'A', after: 'B' } },
      { ...base, type: 'description_edited', payload: { before: '', after: 'Texto' } },
      { ...base, type: 'responsible_changed', payload: { before: userId, after: other } },
      { ...base, type: 'ticket_changed', payload: { before: null, after: { id: 42 } } },
      { ...base, type: 'hours_changed', payload: { participant, before: 100, after: 200 } },
      { ...base, type: 'rate_changed', payload: { participant, before: 5000, after: 6000 } },
      { ...base, type: 'participant_added', payload: { participant, role: 'support' } },
      { ...base, type: 'participant_removed', payload: { participant, role: 'support' } },
      { ...base, type: 'priority_changed', payload: { before: 'normal', after: 'high' } },
    ]
    const descriptions = events.map((event) => describeEvent(event, viewer, names))
    expect(descriptions).toEqual([
      'criou a tarefa',
      'moveu de A fazer para Desenvolvendo',
      'alterou o prazo de sem prazo para 2026-02-01',
      'renomeou de A para B',
      'editou a descrição',
      'alterou o responsável de Ana para Bia',
      'alterou o chamado de sem chamado para #42',
      'alterou as horas de Bia de 1 h para 2 h',
      'alterou o valor/hora de Bia',
      'adicionou Bia como Apoio',
      'removeu Bia de Apoio',
      'alterou a prioridade de Normal para Alta',
    ])
    expect(descriptions[8]).not.toMatch(/R\$|50,00|60,00/)
    expect(describeEvent(events[8]!, { ...viewer, role: 'manager' }, names)).toContain('60,00')
    expect(describeEvent(events[8]!, { ...viewer, userId: other }, names)).toContain('60,00')
    expect(
      describeEvent(
        events[8]!,
        { ...viewer, role: 'manager', organizationId: toOrganizationId(id(2)) },
        names,
      ),
    ).not.toContain('60,00')
  })
})
