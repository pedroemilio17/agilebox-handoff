import { describe, expect, it } from 'vitest'
import { diffTask, describeEvent } from './timeline'
import type { TimelineNames } from './timeline'
import { createTask } from '../entities/task'
import type { Actor } from '../policies/actor'
import { toOrganizationId, toParticipationId, toProjectId, toTaskId, toUserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'

const ulid = (n: number) => String(n).padStart(26, '0')
const at = '2026-03-01T10:00:00.000Z'
const organizationId = toOrganizationId(ulid(1))
const manager: Actor = { userId: toUserId(ulid(3)), organizationId, role: 'manager' }
const names: TimelineNames = {
  organizationId,
  user: () => 'Ana',
  contributor: () => 'Entidade',
}

const base = createTask({
  id: toTaskId(ulid(1)),
  organizationId,
  number: 1,
  projectId: toProjectId(ulid(2)),
  projectName: 'Projeto',
  createdBy: toUserId(ulid(3)),
  title: 'Tarefa',
  createdAt: at,
  responsibleParticipationId: toParticipationId(ulid(5)),
  responsibleRateCents: 0,
})

describe('linha do tempo do início e das dependências', () => {
  it('diffTask gera start_changed com antes e depois, e nada quando o início não muda', () => {
    const started = { ...base, startsOn: parseDateOnly('2026-04-01') }
    expect(diffTask(base, started)).toEqual([
      { type: 'start_changed', payload: { before: null, after: '2026-04-01' } },
    ])
    expect(diffTask(started, started)).toEqual([])
  })

  it('descreve o início, com "sem início" quando remove', () => {
    const event = {
      id: ulid(9) as never,
      taskId: base.id,
      at,
      actorUserId: manager.userId,
      asManager: true,
      type: 'start_changed' as const,
      payload: { before: null, after: parseDateOnly('2026-04-01') },
    }
    expect(describeEvent(event, manager, names)).toBe(
      'alterou o início de sem início para 2026-04-01',
    )
    const removed = { ...event, payload: { before: parseDateOnly('2026-04-01'), after: null } }
    expect(describeEvent(removed, manager, names)).toBe(
      'alterou o início de 2026-04-01 para sem início',
    )
  })

  it('descreve dependência adicionada e removida com chave e título da predecessora', () => {
    const base2 = {
      id: ulid(9) as never,
      taskId: base.id,
      at,
      actorUserId: manager.userId,
      asManager: true,
    }
    const predecessorId = toTaskId(ulid(4))
    expect(
      describeEvent(
        {
          ...base2,
          type: 'dependency_changed',
          payload: {
            action: 'added',
            predecessorId,
            predecessorKey: 'AB-4',
            predecessorTitle: 'Levantamento',
          },
        },
        manager,
        names,
      ),
    ).toBe('passou a depender de AB-4 "Levantamento"')
    expect(
      describeEvent(
        {
          ...base2,
          type: 'dependency_changed',
          payload: {
            action: 'removed',
            predecessorId,
            predecessorKey: 'AB-4',
            predecessorTitle: 'Levantamento',
          },
        },
        manager,
        names,
      ),
    ).toBe('deixou de depender de AB-4 "Levantamento"')
  })
})
