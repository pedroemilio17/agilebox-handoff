import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import {
  toContributorId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import { createParticipation } from './participation'
import {
  addParticipant,
  changeResponsible,
  createTask,
  removeParticipant,
  renameTask,
  setDeadline,
  setDescription,
  setStatus,
  setTicket,
} from './task'

const id = (n: number) => `0000000000000000000000000${n}`
const creator = toUserId(id(1))
const other = toUserId(id(2))
const taskId = toTaskId(id(1))
const base = {
  id: taskId,
  organizationId: toOrganizationId(id(1)),
  projectId: toProjectId(id(1)),
  projectName: '  Projeto Ágil ',
  createdBy: creator,
  title: '  Nova Tarefa ',
  createdAt: '2026-01-01T00:00:00Z',
  responsibleParticipationId: toParticipationId(id(1)),
  responsibleRateCents: 4500,
}
const support = () =>
  createParticipation({
    id: toParticipationId(id(2)),
    taskId,
    participant: { kind: 'user', userId: other },
    role: 'support',
    hoursHundredths: 150,
    rateCents: 5000,
    addedAt: base.createdAt,
  })

describe('tarefa e envolvimento', () => {
  it('cria responsável como criador e normaliza texto de busca', () => {
    const task = createTask(base)
    expect(task).toMatchObject({
      title: 'Nova Tarefa',
      description: '',
      status: 'planning',
      searchText: 'nova tarefa projeto agil',
      deadline: null,
      ticket: null,
    })
    expect(task.participations).toMatchObject([
      {
        participant: { kind: 'user', userId: creator },
        role: 'responsible',
        hoursHundredths: 0,
        rateCents: 4500,
      },
    ])
    expect(() => createTask({ ...base, title: '  ' })).toThrow(ValidationError)
  })
  it('altera campos e atualiza a busca ao renomear', () => {
    const original = createTask(base)
    const renamed = renameTask(original, '  AÇÃO  ')
    expect(renamed.searchText).toBe('acao projeto agil')
    expect(original.title).toBe('Nova Tarefa')
    expect(() => renameTask(original, ' ')).toThrow(ValidationError)
    expect(setDescription(original, 'texto').description).toBe('texto')
    expect(setStatus(original, 'done').status).toBe('done')
    expect(() => setStatus(original, 'invalid' as never)).toThrow(ValidationError)
    expect(setDeadline(original, parseDateOnly('2026-02-01')).deadline).toBe('2026-02-01')
    expect(() => setDeadline(original, '2026-02-30' as never)).toThrow(ValidationError)
    expect(setDeadline(original, null).deadline).toBeNull()
    expect(setTicket(original, { id: 10, url: 'https://example.com' }).ticket?.id).toBe(10)
    expect(() => setTicket(original, { id: 0 })).toThrow(ValidationError)
    expect(setTicket(original, null).ticket).toBeNull()
  })
  it('valida papel, participante, horas e valor copiado', () => {
    const p = support()
    expect(p.rateCents).toBe(5000)
    expect(() => createParticipation({ ...p, hoursHundredths: -1 })).toThrow(ValidationError)
    expect(() => createParticipation({ ...p, rateCents: -1 })).toThrow(ValidationError)
    expect(() => createParticipation({ ...p, role: 'invalid' as never })).toThrow(ValidationError)
    expect(() =>
      createParticipation({
        ...p,
        participant: { kind: 'contributor', contributorId: toContributorId(id(1)) },
        role: 'responsible',
      }),
    ).toThrow(ValidationError)
  })
  it('impede duplicação, outro responsável e envolvimento de outra tarefa', () => {
    const task = createTask(base)
    const withSupport = addParticipant(task, support())
    expect(withSupport.participations).toHaveLength(2)
    expect(() => addParticipant(withSupport, support())).toThrow(ValidationError)
    expect(() => addParticipant(task, { ...support(), role: 'responsible' })).toThrow(
      ValidationError,
    )
    expect(() => addParticipant(task, { ...support(), taskId: toTaskId(id(2)) })).toThrow(
      ValidationError,
    )
    expect(() => addParticipant(task, { ...support(), id: task.participations[0]!.id })).toThrow(
      ValidationError,
    )
  })
  it('troca responsável preservando os envolvimentos e impede sua remoção', () => {
    const task = addParticipant(createTask(base), support())
    expect(() => removeParticipant(task, task.participations[0]!.id)).toThrow(ValidationError)
    expect(() => changeResponsible(task, toUserId(id(3)))).toThrow(ValidationError)
    const changed = changeResponsible(task, other)
    expect(changed.participations.map((p) => p.role)).toEqual(['support', 'responsible'])
    expect(changeResponsible(changed, other)).toEqual(changed)
    expect(removeParticipant(changed, changed.participations[0]!.id).participations).toHaveLength(1)
    expect(() => removeParticipant(changed, toParticipationId(id(9)))).toThrow(ValidationError)
  })
})
