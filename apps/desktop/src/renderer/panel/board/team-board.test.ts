import { describe, expect, it } from 'vitest'
import type { TaskDto } from '@agilebox/contract'
import { teamWipColumns } from './team-board'

const task = (status: TaskDto['status']) => ({ status })

describe('teamWipColumns', () => {
  it('conta só as tarefas exibidas nas colunas com limite de WIP', () => {
    const columns = teamWipColumns(
      [task('in_progress'), task('in_progress'), task('in_progress'), task('review'), task('todo')],
      { in_progress: 2 },
    )
    expect(columns).toEqual([
      { status: 'in_progress', count: 3, limit: 2, state: 'over' },
      { status: 'review', count: 1, limit: null, state: 'none' },
    ])
  })

  it('marca no limite quando a contagem iguala o limite', () => {
    const review = teamWipColumns([task('review')], { review: 1 }).find(
      (column) => column.status === 'review',
    )
    expect(review).toEqual({ status: 'review', count: 1, limit: 1, state: 'at_limit' })
  })

  it('sem tarefas, a contagem é zero', () => {
    expect(teamWipColumns([], {}).map((column) => column.count)).toEqual([0, 0])
  })
})
