import { describe, expect, it } from 'vitest'
import { API_CHANNELS } from './channels'
import { API_SCHEMA_REGISTRY } from './api'
import { archiveProjectInputSchema, listProjectsInputSchema, projectDtoSchema } from './projects'
import {
  archiveTaskInputSchema,
  listBoardInputSchema,
  listTeamBoardInputSchema,
  taskDtoSchema,
  unarchiveTaskInputSchema,
} from './tasks'
import { timelineEventTypeSchema } from './timeline'

const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const projectId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

describe('schemas de arquivamento', () => {
  it('registra os canais de arquivar e desarquivar tarefa e projeto', () => {
    for (const channel of [
      'tasks.archive',
      'tasks.unarchive',
      'projects.archive',
      'projects.unarchive',
    ] as const) {
      expect(API_CHANNELS).toContain(channel)
      expect(API_SCHEMA_REGISTRY[channel]).toBeDefined()
    }
  })

  it('arquivar e desarquivar pedem só um id válido', () => {
    expect(archiveTaskInputSchema.parse({ taskId })).toEqual({ taskId })
    expect(unarchiveTaskInputSchema.parse({ taskId })).toEqual({ taskId })
    expect(archiveProjectInputSchema.parse({ projectId })).toEqual({ projectId })
    expect(() => archiveTaskInputSchema.parse({ taskId: 'x' })).toThrow()
    expect(() => archiveProjectInputSchema.parse({ projectId: '' })).toThrow()
  })

  it('quadro e equipe aceitam includeArchived opcional; padrão fica de fora', () => {
    expect(listBoardInputSchema.parse({})).toEqual({})
    expect(listBoardInputSchema.parse({ includeArchived: true })).toEqual({ includeArchived: true })
    expect(listTeamBoardInputSchema.parse({ includeArchived: false })).toEqual({
      includeArchived: false,
    })
    expect(() => listTeamBoardInputSchema.parse({ includeArchived: 'sim' })).toThrow()
  })

  it('lista de projetos aceita sem argumento ou com includeArchived', () => {
    expect(listProjectsInputSchema.parse(undefined)).toBeUndefined()
    expect(listProjectsInputSchema.parse({ includeArchived: true })).toEqual({
      includeArchived: true,
    })
  })

  it('DTOs de tarefa e projeto aceitam archivedAt nulo, e respostas antigas sem o campo', () => {
    const task = { ...dtoBase(), archivedAt: null }
    expect(taskDtoSchema.safeParse(task).success).toBe(true)
    expect(
      taskDtoSchema.safeParse({ ...dtoBase(), archivedAt: '2026-02-01T10:00:00.000Z' }).success,
    ).toBe(true)
    expect(taskDtoSchema.safeParse(dtoBase()).success).toBe(true)
    expect(
      projectDtoSchema.safeParse({
        id: projectId,
        name: 'P',
        createdBy: taskId,
        createdAt: '2026-01-01T00:00:00.000Z',
        definitionOfDoneCount: 0,
        archivedAt: null,
      }).success,
    ).toBe(true)
  })

  it('linha do tempo conhece os eventos de arquivar e desarquivar', () => {
    expect(timelineEventTypeSchema.parse('task_archived')).toBe('task_archived')
    expect(timelineEventTypeSchema.parse('task_unarchived')).toBe('task_unarchived')
  })
})

function dtoBase() {
  return {
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
    deadline: null,
    ticketId: null,
    ticketUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    checklistProgress: { done: 0, total: 0, percent: 0 },
    commentCount: 0,
  }
}
