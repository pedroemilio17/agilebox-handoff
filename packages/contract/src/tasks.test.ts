import { describe, expect, it } from 'vitest'
import {
  taskDtoSchema,
  archiveTaskInputSchema,
  archiveTaskOutputSchema,
  unarchiveTaskInputSchema,
  createTaskInputSchema,
  getTaskOutputSchema,
  listArchivedTasksInputSchema,
  listArchivedTasksOutputSchema,
  listBoardInputSchema,
  listBoardOutputSchema,
  listTeamBoardInputSchema,
  listTeamBoardOutputSchema,
  moveTaskInputSchema,
  recordTaskOpenInputSchema,
  searchTasksInputSchema,
  taskListScopeSchema,
  taskUpdateInputSchema,
} from './tasks'

const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const projectId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAX'
const participationId = '01ARZ3NDEKTSV4RRFFQ69G5FAY'

const task = {
  id: taskId,
  projectId,
  projectName: 'Projeto Ágil',
  title: 'Implementar quadro',
  description: '',
  status: 'in_progress',
  deadline: null,
  ticketId: null,
  ticketUrl: null,
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:30:00.000Z',
  backlogRank: null,
  onBoard: true,
  estimatedHours: null,
  estimatedCost: null,
  realizedCost: null,
}

describe('estimativa, custos e aceite no DTO da tarefa (M3.8b)', () => {
  it('exige horas estimadas, custo estimado e realizado como número ou nulo, sem ausência', () => {
    expect(
      taskDtoSchema.parse({ ...task, estimatedHours: 2.5, estimatedCost: 225, realizedCost: 45 }),
    ).toMatchObject({ estimatedHours: 2.5, estimatedCost: 225, realizedCost: 45 })
    expect(taskDtoSchema.safeParse({ ...task, estimatedHours: undefined }).success).toBe(false)
    expect(taskDtoSchema.safeParse({ ...task, estimatedCost: undefined }).success).toBe(false)
    expect(taskDtoSchema.safeParse({ ...task, realizedCost: undefined }).success).toBe(false)
  })

  it('recusa horas estimadas negativas, acima de 1000 h ou NaN, e custo negativo', () => {
    expect(taskDtoSchema.safeParse({ ...task, estimatedHours: -1 }).success).toBe(false)
    expect(taskDtoSchema.safeParse({ ...task, estimatedHours: 1000.5 }).success).toBe(false)
    expect(taskDtoSchema.safeParse({ ...task, estimatedHours: Number.NaN }).success).toBe(false)
    expect(taskDtoSchema.safeParse({ ...task, estimatedCost: -5 }).success).toBe(false)
    expect(
      taskDtoSchema.safeParse({ ...task, realizedCost: Number.POSITIVE_INFINITY }).success,
    ).toBe(false)
  })

  it('o resumo do aceite é opcional, e quando vem, feitos não passam do total', () => {
    expect(taskDtoSchema.parse(task)).not.toHaveProperty('acceptance')
    expect(taskDtoSchema.parse({ ...task, acceptance: { done: 1, total: 3 } })).toMatchObject({
      acceptance: { done: 1, total: 3 },
    })
    expect(taskDtoSchema.safeParse({ ...task, acceptance: { done: 4, total: 3 } }).success).toBe(
      false,
    )
  })
})

describe('schemas de tarefas', () => {
  it('exige backlogRank (nulo ou posição 1..n) e onBoard booleano no DTO', () => {
    expect(taskDtoSchema.parse({ ...task, backlogRank: 3, onBoard: false })).toMatchObject({
      backlogRank: 3,
      onBoard: false,
    })
    expect(taskDtoSchema.safeParse({ ...task, backlogRank: 0 }).success).toBe(false)
    expect(taskDtoSchema.safeParse({ ...task, backlogRank: 1.5 }).success).toBe(false)
    expect(taskDtoSchema.safeParse({ ...task, backlogRank: undefined }).success).toBe(false)
    expect(taskDtoSchema.safeParse({ ...task, onBoard: 'sim' }).success).toBe(false)
    expect(taskDtoSchema.safeParse({ ...task, onBoard: undefined }).success).toBe(false)
  })

  it('aceita criação no backlog por inBacklog booleano e recusa outro tipo', () => {
    expect(createTaskInputSchema.parse({ projectId, title: 'Nova', inBacklog: true })).toEqual({
      projectId,
      title: 'Nova',
      inBacklog: true,
    })
    expect(createTaskInputSchema.parse({ projectId, title: 'Nova' })).not.toHaveProperty(
      'inBacklog',
    )
    expect(
      createTaskInputSchema.safeParse({ projectId, title: 'Nova', inBacklog: 'sim' }).success,
    ).toBe(false)
  })

  it('aceita filtros de quadro pessoal e de equipe', () => {
    expect(listBoardInputSchema.parse({ projectId, forUserId: userId })).toEqual({
      projectId,
      forUserId: userId,
    })
    expect(listTeamBoardInputSchema.parse({ projectId })).toEqual({ projectId })
    expect(listTeamBoardInputSchema.parse({})).toEqual({})
    expect(listBoardOutputSchema.parse([task])).toEqual([task])
    expect(listTeamBoardOutputSchema.parse([task])).toEqual([task])
  })

  it('rejeita identificadores inválidos nos filtros e métodos de tarefa', () => {
    expect(listTeamBoardInputSchema.safeParse({ projectId: 'projeto-1' }).success).toBe(false)
    expect(
      getTaskOutputSchema.safeParse({
        ...task,
        id: 'tarefa-1',
        participations: [],
        total: null,
        canEdit: true,
        readOnly: false,
      }).success,
    ).toBe(false)
    expect(recordTaskOpenInputSchema.safeParse({ taskId: 'tarefa-1' }).success).toBe(false)
  })

  it('aceita detalhe com permissão explícita e rejeita flags contraditórias', () => {
    const detail = {
      ...task,
      participations: [
        {
          id: participationId,
          participant: { kind: 'user', userId },
          participantName: 'Ana Lima',
          role: 'responsible',
          hours: 0,
          rate: null,
        },
      ],
      total: null,
      canEdit: true,
      readOnly: false,
    }
    expect(getTaskOutputSchema.parse(detail)).toEqual(detail)
    expect(
      getTaskOutputSchema.safeParse({ ...detail, canEdit: false, readOnly: false }).success,
    ).toBe(false)
  })

  it('aceita criação e atualização parcial da tarefa', () => {
    expect(createTaskInputSchema.parse({ projectId, title: '  Nova tarefa  ' })).toEqual({
      projectId,
      title: 'Nova tarefa',
    })
    expect(taskUpdateInputSchema.parse({ taskId, changes: { title: '  Ajuste  ' } })).toEqual({
      taskId,
      changes: { title: 'Ajuste' },
    })
    expect(moveTaskInputSchema.parse({ taskId, status: 'review' })).toEqual({
      taskId,
      status: 'review',
    })
  })

  it('aceita os escopos mine e team na listagem e rejeita outros valores', () => {
    expect(taskListScopeSchema.parse('mine')).toBe('mine')
    expect(taskListScopeSchema.parse('team')).toBe('team')
    expect(taskListScopeSchema.safeParse('all').success).toBe(false)
    expect(taskListScopeSchema.safeParse('').success).toBe(false)
    expect(listBoardInputSchema.parse({ projectId, scope: 'team' })).toEqual({
      projectId,
      scope: 'team',
    })
    expect(listBoardInputSchema.safeParse({ scope: 'todos' }).success).toBe(false)
  })

  it('aceita arquivar e desarquivar tarefa com identificador válido', () => {
    expect(archiveTaskInputSchema.parse({ taskId })).toEqual({ taskId })
    expect(unarchiveTaskInputSchema.parse({ taskId })).toEqual({ taskId })
    expect(archiveTaskOutputSchema.parse(task)).toEqual(task)
    expect(archiveTaskInputSchema.safeParse({}).success).toBe(false)
    expect(unarchiveTaskInputSchema.safeParse({ taskId: 'tarefa-1' }).success).toBe(false)
  })

  it('lista as tarefas arquivadas sem entrada e devolve a mesma forma de tarefa do quadro', () => {
    expect(listArchivedTasksInputSchema.parse(undefined)).toBeUndefined()
    expect(listArchivedTasksInputSchema.safeParse({}).success).toBe(false)
    expect(listArchivedTasksOutputSchema.parse([task])).toEqual([task])
    expect(listArchivedTasksOutputSchema.safeParse([{ ...task, id: 'tarefa-1' }]).success).toBe(
      false,
    )
  })

  it('rejeita título vazio, atualização vazia e estados inválidos', () => {
    expect(createTaskInputSchema.safeParse({ projectId, title: '  ' }).success).toBe(false)
    expect(taskUpdateInputSchema.safeParse({ taskId, changes: {} }).success).toBe(false)
    expect(moveTaskInputSchema.safeParse({ taskId, status: 'blocked' }).success).toBe(false)
    expect(searchTasksInputSchema.safeParse({ query: '   ' }).success).toBe(false)
  })
})
