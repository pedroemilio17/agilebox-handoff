import { describe, expect, it } from 'vitest'
import { parseDateOnly } from '@agilebox/core'
import {
  attentionItems,
  countByStatus,
  dayMonthLabel,
  highlightTasks,
  percentOf,
  sprintDaysLeftLabel,
  type HomeTask,
} from './project-home-rules'

const TODAY = parseDateOnly('2026-11-23')

function task(overrides: Partial<HomeTask> & Pick<HomeTask, 'id' | 'key' | 'status'>): HomeTask {
  return {
    title: `Tarefa ${overrides.key}`,
    inBacklog: false,
    blockedAt: null,
    blockedReason: null,
    overdue: false,
    deadline: null,
    updatedAt: '2026-11-20T10:00:00.000Z',
    ...overrides,
  }
}

describe('countByStatus', () => {
  it('conta as tarefas por estado e deixa de fora as do backlog', () => {
    const counts = countByStatus([
      task({ id: '1', key: 'AB-1', status: 'todo' }),
      task({ id: '2', key: 'AB-2', status: 'todo' }),
      task({ id: '3', key: 'AB-3', status: 'done' }),
      task({ id: '4', key: 'AB-4', status: 'todo', inBacklog: true }),
    ])
    expect(counts).toEqual({ planning: 0, todo: 2, in_progress: 0, review: 0, done: 1 })
  })
})

describe('percentOf', () => {
  it('arredonda e devolve zero sem total', () => {
    expect(percentOf(5, 11)).toBe(45)
    expect(percentOf(0, 0)).toBe(0)
  })
})

describe('highlightTasks', () => {
  it('mostra as abertas mais recentes, sem concluídas nem backlog', () => {
    const picked = highlightTasks(
      [
        task({ id: '1', key: 'AB-1', status: 'done', updatedAt: '2026-11-22T10:00:00.000Z' }),
        task({ id: '2', key: 'AB-2', status: 'todo', updatedAt: '2026-11-18T10:00:00.000Z' }),
        task({ id: '3', key: 'AB-3', status: 'review', updatedAt: '2026-11-21T10:00:00.000Z' }),
        task({
          id: '4',
          key: 'AB-4',
          status: 'todo',
          inBacklog: true,
          updatedAt: '2026-11-23T10:00:00.000Z',
        }),
      ],
      4,
    )
    expect(picked.map((item) => item.key)).toEqual(['AB-3', 'AB-2'])
  })

  it('respeita o limite', () => {
    const many = ['1', '2', '3', '4', '5'].map((n) =>
      task({ id: n, key: `AB-${n}`, status: 'todo' }),
    )
    expect(highlightTasks(many, 2)).toHaveLength(2)
  })
})

describe('attentionItems', () => {
  it('lista bloqueios com a quantidade de dias e aponta para a tarefa', () => {
    const items = attentionItems(
      [
        task({
          id: '8',
          key: 'AB-8',
          status: 'in_progress',
          blockedAt: '2026-11-21T12:00:00.000Z',
          blockedReason: 'aguardando homologação',
        }),
      ],
      [],
      TODAY,
      'UTC',
    )
    expect(items).toEqual([
      expect.objectContaining({
        tone: 'danger',
        title: 'AB-8 bloqueada há 2 dias',
        meta: 'aguardando homologação',
        taskId: '8',
      }),
    ])
  })

  it('diz "hoje" e "há 1 dia" nos bloqueios recentes', () => {
    const items = attentionItems(
      [
        task({ id: '1', key: 'AB-1', status: 'todo', blockedAt: '2026-11-23T08:00:00.000Z' }),
        task({ id: '2', key: 'AB-2', status: 'todo', blockedAt: '2026-11-22T08:00:00.000Z' }),
      ],
      [],
      TODAY,
      'UTC',
    )
    expect(items.map((item) => item.title)).toEqual([
      'AB-1 bloqueada hoje',
      'AB-2 bloqueada há 1 dia',
    ])
  })

  it('lista prazo vencido e coluna do WIP acima do limite', () => {
    const items = attentionItems(
      [
        task({
          id: '5',
          key: 'AB-5',
          status: 'in_progress',
          overdue: true,
          deadline: '2026-11-20',
        }),
      ],
      [
        { status: 'in_progress', count: 2, limit: 3, state: 'ok' },
        { status: 'review', count: 4, limit: 3, state: 'over' },
        { status: 'review', count: 1, limit: null, state: 'ok' },
      ],
      TODAY,
      'UTC',
    )
    expect(items).toEqual([
      expect.objectContaining({ tone: 'danger', title: 'AB-5 com prazo vencido', taskId: '5' }),
      expect.objectContaining({
        tone: 'warning',
        title: 'Coluna Revisar acima do limite de WIP',
        meta: '4 de 3 tarefas',
        taskId: null,
      }),
    ])
  })

  it('fica vazia quando nada pede atenção', () => {
    expect(
      attentionItems([task({ id: '1', key: 'AB-1', status: 'todo' })], [], TODAY, 'UTC'),
    ).toEqual([])
  })
})

describe('dayMonthLabel', () => {
  it('formata a data como dd/mm', () => {
    expect(dayMonthLabel('2026-11-04')).toBe('04/11')
  })
})

describe('sprintDaysLeftLabel', () => {
  it('descreve o tempo que resta da sprint', () => {
    expect(sprintDaysLeftLabel(4)).toBe('Restam 4 dias')
    expect(sprintDaysLeftLabel(1)).toBe('Resta 1 dia')
    expect(sprintDaysLeftLabel(0)).toBe('Termina hoje')
    expect(sprintDaysLeftLabel(-2)).toBe('Prazo passou há 2 dias')
  })
})
