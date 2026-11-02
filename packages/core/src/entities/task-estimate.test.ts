import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toOrganizationId, toParticipationId, toProjectId, toTaskId, toUserId } from '../shared/ids'
import { createParticipation } from './participation'
import { addParticipant, createTask, setEstimatedHours } from './task'

const id = (n: number) => String(n).padStart(26, '0')
const newTask = () =>
  createTask({
    id: toTaskId(id(1)),
    organizationId: toOrganizationId(id(1)),
    projectId: toProjectId(id(1)),
    projectName: 'Projeto',
    createdBy: toUserId(id(1)),
    title: 'Tarefa',
    createdAt: '2026-01-01T00:00:00Z',
    responsibleParticipationId: toParticipationId(id(1)),
    responsibleRateCents: 4500,
  })

describe('estimativa da tarefa (ADR-07)', () => {
  it('tarefa nova nasce sem estimativa', () => {
    expect(newTask().estimatedHours).toBeNull()
  })

  it('define a estimativa sem tocar nas horas realizadas nem nos envolvidos', () => {
    const task = addParticipant(
      newTask(),
      createParticipation({
        id: toParticipationId(id(2)),
        taskId: toTaskId(id(1)),
        participant: { kind: 'user', userId: toUserId(id(2)) },
        role: 'support',
        hoursHundredths: 150,
        rateCents: 5000,
        addedAt: '2026-01-02T00:00:00Z',
      }),
    )
    const estimated = setEstimatedHours(task, 4000)
    expect(estimated.estimatedHours).toBe(4000)
    expect(estimated.participations).toEqual(task.participations)
    expect(estimated.participations.map((p) => p.hoursHundredths)).toEqual([0, 150])
    expect(task.estimatedHours).toBeNull()
  })

  it('zero é uma estimativa válida, diferente de nulo', () => {
    expect(setEstimatedHours(newTask(), 0).estimatedHours).toBe(0)
  })

  it('normaliza -0 para zero, que é uma estimativa válida', () => {
    expect(Object.is(setEstimatedHours(newTask(), -0).estimatedHours, 0)).toBe(true)
  })

  it('limpar a estimativa devolve nulo', () => {
    expect(setEstimatedHours(setEstimatedHours(newTask(), 4000), null).estimatedHours).toBeNull()
  })

  it('recusa valor negativo, fracionado ou acima do limite', () => {
    expect(() => setEstimatedHours(newTask(), -1)).toThrow(ValidationError)
    expect(() => setEstimatedHours(newTask(), 1.5)).toThrow(ValidationError)
    expect(() => setEstimatedHours(newTask(), 100_001)).toThrow(ValidationError)
  })
})
