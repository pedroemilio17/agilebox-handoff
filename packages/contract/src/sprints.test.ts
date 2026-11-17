import { describe, expect, it } from 'vitest'
import { API_CHANNELS } from './channels'
import { API_SCHEMA_REGISTRY } from './api'
import {
  closeSprintInputSchema,
  createSprintInputSchema,
  discardSprintInputSchema,
  sprintDtoSchema,
} from './sprints'
import { setModuleConfigInputSchema } from './team-tools'
import { taskDtoSchema } from './tasks'
import { timelineEventTypeSchema } from './timeline'

const sprintId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const nextSprintId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const projectId = '01ARZ3NDEKTSV4RRFFQ69G5FAX'
const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAY'
const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAZ'

describe('contrato das sprints', () => {
  it('registra os canais de sprint e de configuração do módulo', () => {
    for (const channel of [
      'sprints.list',
      'sprints.get',
      'sprints.create',
      'sprints.update',
      'sprints.start',
      'sprints.close',
      'sprints.discard',
      'sprints.addTask',
      'sprints.removeTask',
      'teamTools.setModuleConfig',
    ] as const) {
      expect(API_CHANNELS).toContain(channel)
      expect(API_SCHEMA_REGISTRY[channel]).toBeDefined()
    }
  })

  it('a política carry_over exige a sprint seguinte, e return_to_backlog não a aceita', () => {
    expect(closeSprintInputSchema.safeParse({ sprintId, policy: 'carry_over' }).success).toBe(false)
    expect(
      closeSprintInputSchema.safeParse({ sprintId, policy: 'carry_over', nextSprintId }).success,
    ).toBe(true)
    expect(
      closeSprintInputSchema.safeParse({ sprintId, policy: 'return_to_backlog', nextSprintId })
        .success,
    ).toBe(false)
    expect(
      closeSprintInputSchema.safeParse({ sprintId, policy: 'return_to_backlog' }).success,
    ).toBe(true)
  })

  it('limita nome e meta, e recusa data que não existe', () => {
    expect(
      createSprintInputSchema.safeParse({
        projectId,
        name: 'x'.repeat(81),
        plannedStart: '2026-11-16',
        plannedEnd: '2026-11-27',
      }).success,
    ).toBe(false)
    expect(
      createSprintInputSchema.safeParse({
        projectId,
        goal: 'x'.repeat(281),
        plannedStart: '2026-11-16',
        plannedEnd: '2026-11-27',
      }).success,
    ).toBe(false)
    expect(
      createSprintInputSchema.safeParse({
        projectId,
        plannedStart: '2026-02-30',
        plannedEnd: '2026-03-01',
      }).success,
    ).toBe(false)
  })

  it('descartar aceita só o id e a confirmação de devolver ao backlog', () => {
    expect(discardSprintInputSchema.safeParse({ sprintId, returnToBacklog: true }).success).toBe(
      true,
    )
    expect(discardSprintInputSchema.safeParse({ sprintId, userId }).success).toBe(true)
    expect(discardSprintInputSchema.parse({ sprintId, userId })).toEqual({ sprintId })
  })

  it('a sprint do DTO carrega "Sprint N" e o estado; a tarefa carrega a sprint aberta ou nula', () => {
    const sprint = sprintDtoSchema.parse({
      id: sprintId,
      projectId,
      number: 4,
      label: 'Sprint 4',
      name: 'Sprint 4',
      goal: null,
      plannedStart: '2026-11-16',
      plannedEnd: '2026-11-27',
      status: 'active',
      startedAt: '2026-11-16T12:00:00.000Z',
      closedAt: null,
      closePolicy: null,
      createdBy: userId,
      createdAt: '2026-11-15T12:00:00.000Z',
    })
    expect(sprint.label).toBe('Sprint 4')
    const task = {
      id: taskId,
      number: 1,
      key: 'AB-1',
      projectId,
      projectName: 'Projeto',
      title: 'Tarefa',
      description: '',
      status: 'todo',
      priority: 'normal',
      blockedReason: null,
      blockedAt: null,
      ticketId: null,
      ticketUrl: null,
      deadline: null,
      checklistProgress: { done: 0, total: 0, percent: 0 },
      commentCount: 0,
      createdAt: '2026-11-15T12:00:00.000Z',
      updatedAt: '2026-11-15T12:00:00.000Z',
      sprint: { id: sprintId, number: 4, name: 'Sprint 4', status: 'active' },
    }
    expect(taskDtoSchema.parse(task).sprint?.number).toBe(4)
    expect(taskDtoSchema.parse({ ...task, sprint: null }).sprint).toBeNull()
    // Resposta antiga, sem o campo: tratar como nulo, sem quebrar.
    const withoutSprint: Record<string, unknown> = { ...task }
    delete withoutSprint.sprint
    expect(taskDtoSchema.parse(withoutSprint).sprint).toBeUndefined()
  })

  it('a linha do tempo conhece entrar e sair de sprint', () => {
    expect(timelineEventTypeSchema.safeParse('task_added_to_sprint').success).toBe(true)
    expect(timelineEventTypeSchema.safeParse('task_removed_from_sprint').success).toBe(true)
  })

  it('a configuração do módulo aceita objeto simples com chave e valor', () => {
    expect(
      setModuleConfigInputSchema.safeParse({ moduleId: 'sprints', config: { maxActiveSprints: 2 } })
        .success,
    ).toBe(true)
    expect(setModuleConfigInputSchema.safeParse({ moduleId: 'sprints' }).success).toBe(false)
  })
})
