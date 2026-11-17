import { describe, expect, it } from 'vitest'
import { renameDeliverable } from './deliverable'
import { ValidationError } from '../shared/errors'
import { toDeliverableId, toOrganizationId, toProjectId, toUserId } from '../shared/ids'
import { setTaskDeliverable, createTask } from './task'
import { toParticipationId, toTaskId } from '../shared/ids'
import { createDeliverable } from './deliverable'

const ulid = (n: number) => String(n).padStart(26, '0')
const at = '2026-03-01T10:00:00.000Z'

describe('entrega', () => {
  it('cria raiz com posição e renomeia com validação', () => {
    const created = createDeliverable(
      {
        id: toDeliverableId(ulid(1)),
        organizationId: toOrganizationId(ulid(1)),
        projectId: toProjectId(ulid(2)),
        parentId: null,
        title: '  Fundação  ',
        position: 0,
        createdBy: toUserId(ulid(3)),
        createdAt: at,
      },
      [],
    )
    expect(created.title).toBe('Fundação')
    expect(renameDeliverable(created, ' Base ').title).toBe('Base')
    expect(() => renameDeliverable(created, '')).toThrow(ValidationError)
  })
})

describe('campo deliverableId da tarefa', () => {
  const task = createTask({
    id: toTaskId(ulid(4)),
    organizationId: toOrganizationId(ulid(1)),
    number: 1,
    projectId: toProjectId(ulid(2)),
    projectName: 'Projeto',
    createdBy: toUserId(ulid(3)),
    title: 'Tarefa',
    createdAt: at,
    responsibleParticipationId: toParticipationId(ulid(5)),
    responsibleRateCents: 0,
  })

  it('nasce nulo e aceita entrega opcional', () => {
    expect(task.deliverableId).toBeNull()
    const linked = createTask({
      id: toTaskId(ulid(6)),
      organizationId: toOrganizationId(ulid(1)),
      number: 2,
      projectId: toProjectId(ulid(2)),
      projectName: 'Projeto',
      createdBy: toUserId(ulid(3)),
      title: 'Tarefa 2',
      createdAt: at,
      responsibleParticipationId: toParticipationId(ulid(7)),
      responsibleRateCents: 0,
      deliverableId: toDeliverableId(ulid(8)),
    })
    expect(linked.deliverableId).toBe(toDeliverableId(ulid(8)))
  })

  it('setTaskDeliverable muda só o campo e devolve a mesma tarefa quando não muda', () => {
    const target = toDeliverableId(ulid(9))
    const linked = setTaskDeliverable(task, target)
    expect(linked).toEqual({ ...task, deliverableId: target })
    expect(setTaskDeliverable(linked, target)).toBe(linked)
    expect(setTaskDeliverable(linked, null).deliverableId).toBeNull()
  })
})
