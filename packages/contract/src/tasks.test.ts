import { describe, expect, it } from 'vitest'
import {
  createTaskInputSchema,
  getTaskOutputSchema,
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
}

describe('schemas de tarefas', () => {
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

  it('rejeita título vazio, atualização vazia e estados inválidos', () => {
    expect(createTaskInputSchema.safeParse({ projectId, title: '  ' }).success).toBe(false)
    expect(taskUpdateInputSchema.safeParse({ taskId, changes: {} }).success).toBe(false)
    expect(moveTaskInputSchema.safeParse({ taskId, status: 'blocked' }).success).toBe(false)
    expect(searchTasksInputSchema.safeParse({ query: '   ' }).success).toBe(false)
  })
})
