import { describe, expect, it } from 'vitest'
import { ConflictError, ValidationError } from '../shared/errors'
import { toOrganizationId, toParticipationId, toProjectId, toTaskId, toUserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import { createTask, setDeadline, setTaskStart } from './task'

const ulid = (n: number) => String(n).padStart(26, '0')
const at = '2026-03-01T10:00:00.000Z'
const day = (value: string) => parseDateOnly(value)

const dateOrNull = (value: string | null | undefined) => (value ? day(value) : null)

function taskWith(overrides: { startsOn?: string | null; deadline?: string | null } = {}) {
  const base = createTask({
    id: toTaskId(ulid(1)),
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
  return {
    ...base,
    startsOn: dateOrNull(overrides.startsOn),
    deadline: dateOrNull(overrides.deadline),
  }
}

describe('início e prazo da tarefa (cronograma)', () => {
  it('nasce sem início e aceita início opcional na criação', () => {
    expect(taskWith().startsOn).toBeNull()
    const created = createTask({
      id: toTaskId(ulid(6)),
      organizationId: toOrganizationId(ulid(1)),
      number: 2,
      projectId: toProjectId(ulid(2)),
      projectName: 'Projeto',
      createdBy: toUserId(ulid(3)),
      title: 'Com início',
      createdAt: at,
      responsibleParticipationId: toParticipationId(ulid(7)),
      responsibleRateCents: 0,
      startsOn: day('2026-04-01'),
    })
    expect(created.startsOn).toBe('2026-04-01')
  })

  it('setTaskStart define, limpa e devolve a mesma tarefa quando não muda', () => {
    const task = taskWith()
    const started = setTaskStart(task, day('2026-04-01'))
    expect(started.startsOn).toBe('2026-04-01')
    expect(setTaskStart(started, day('2026-04-01'))).toBe(started)
    expect(setTaskStart(started, null).startsOn).toBeNull()
  })

  it('setTaskStart aceita início no mesmo dia do prazo, mas recusa início depois do prazo', () => {
    const task = taskWith({ deadline: '2026-04-10' })
    expect(setTaskStart(task, day('2026-04-10')).startsOn).toBe('2026-04-10')
    expect(() => setTaskStart(task, day('2026-04-11'))).toThrow(ValidationError)
    expect(() => setTaskStart(task, day('2026-04-11'))).toThrow(
      'O início não pode ser depois do prazo',
    )
  })

  it('setTaskStart recusa tarefa arquivada e data inválida', () => {
    const archived = { ...taskWith(), archivedAt: at, archivedBy: toUserId(ulid(3)) }
    expect(() => setTaskStart(archived, day('2026-04-01'))).toThrow(ConflictError)
    expect(() => setTaskStart(archived, null)).toThrow('Tarefa arquivada não pode ser alterada')
    expect(() => setTaskStart(taskWith(), '2026-02-30' as never)).toThrow(ValidationError)
  })

  it('setDeadline não aceita prazo antes do início existente', () => {
    const task = taskWith({ startsOn: '2026-04-05' })
    expect(() => setDeadline(task, day('2026-04-04'))).toThrow(
      'O prazo não pode ser antes do início',
    )
    expect(setDeadline(task, day('2026-04-05')).deadline).toBe('2026-04-05')
    expect(setDeadline(task, null).deadline).toBeNull()
  })

  it('setDeadline sem início segue como antes, sem restrição', () => {
    expect(setDeadline(taskWith(), day('2020-01-01')).deadline).toBe('2020-01-01')
  })
})
