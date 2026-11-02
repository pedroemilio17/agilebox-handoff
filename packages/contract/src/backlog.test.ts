import { describe, expect, it } from 'vitest'
import {
  backlogPlacementSchema,
  listBacklogInputSchema,
  listBacklogOutputSchema,
  reorderBacklogInputSchema,
  reorderBacklogOutputSchema,
  sendToBacklogInputSchema,
  sendToBacklogOutputSchema,
  takeToBoardInputSchema,
  takeToBoardOutputSchema,
} from './backlog'

const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const projectId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

const task = {
  id: taskId,
  projectId,
  projectName: 'Projeto Ágil',
  title: 'Revisar login',
  description: '',
  status: 'planning',
  deadline: null,
  ticketId: null,
  ticketUrl: null,
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:30:00.000Z',
  backlogRank: 2,
  onBoard: false,
  estimatedHours: null,
  estimatedCost: null,
  realizedCost: null,
}

describe('posição no backlog', () => {
  it('aceita topo, fim e índice inteiro não negativo (0-based)', () => {
    expect(backlogPlacementSchema.parse('top')).toBe('top')
    expect(backlogPlacementSchema.parse('end')).toBe('end')
    expect(backlogPlacementSchema.parse(0)).toBe(0)
    expect(backlogPlacementSchema.parse(7)).toBe(7)
  })

  it('recusa índice negativo, não inteiro, não numérico e não finito', () => {
    expect(backlogPlacementSchema.safeParse(-1).success).toBe(false)
    expect(backlogPlacementSchema.safeParse(1.5).success).toBe(false)
    expect(backlogPlacementSchema.safeParse(Number.NaN).success).toBe(false)
    expect(backlogPlacementSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false)
    expect(backlogPlacementSchema.safeParse('middle').success).toBe(false)
    expect(backlogPlacementSchema.safeParse('2').success).toBe(false)
    expect(backlogPlacementSchema.safeParse(null).success).toBe(false)
  })
})

describe('schemas de entrada e saída do backlog', () => {
  it('lista o backlog sem filtro ou com projeto, e recusa id de projeto malformado', () => {
    expect(listBacklogInputSchema.parse({})).toEqual({})
    expect(listBacklogInputSchema.parse({ projectId })).toEqual({ projectId })
    expect(listBacklogInputSchema.safeParse({ projectId: 'projeto-1' }).success).toBe(false)
    expect(listBacklogOutputSchema.parse([task])).toEqual([task])
  })

  it('reordena com id válido e posição válida, e recusa id malformado ou posição inválida', () => {
    expect(reorderBacklogInputSchema.parse({ taskId, placement: 'top' })).toEqual({
      taskId,
      placement: 'top',
    })
    expect(reorderBacklogInputSchema.parse({ taskId, placement: 0 })).toEqual({
      taskId,
      placement: 0,
    })
    expect(
      reorderBacklogInputSchema.safeParse({ taskId: 'tarefa-1', placement: 'end' }).success,
    ).toBe(false)
    expect(reorderBacklogInputSchema.safeParse({ taskId, placement: -1 }).success).toBe(false)
    expect(reorderBacklogInputSchema.safeParse({ taskId, placement: 0.5 }).success).toBe(false)
    expect(reorderBacklogInputSchema.safeParse({ taskId }).success).toBe(false)
    expect(reorderBacklogOutputSchema.parse(undefined)).toBeUndefined()
  })

  it('leva ao quadro e devolve ao backlog por id da tarefa, com a tarefa na saída', () => {
    expect(takeToBoardInputSchema.parse({ taskId })).toEqual({ taskId })
    expect(sendToBacklogInputSchema.parse({ taskId })).toEqual({ taskId })
    expect(
      takeToBoardOutputSchema.parse({ ...task, backlogRank: null, onBoard: true }),
    ).toMatchObject({ onBoard: true, backlogRank: null })
    expect(sendToBacklogOutputSchema.parse(task)).toEqual(task)
    expect(takeToBoardInputSchema.safeParse({}).success).toBe(false)
    expect(sendToBacklogInputSchema.safeParse({ taskId: 'tarefa-1' }).success).toBe(false)
  })

  it('devolver ao backlog recebe só o id: posição extra no corpo é descartada, não aplicada', () => {
    expect(sendToBacklogInputSchema.parse({ taskId, placement: 'top' })).toEqual({ taskId })
  })
})
