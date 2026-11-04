import { describe, expect, it } from 'vitest'
import { createTask, type Task } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import {
  toTaskId,
  toProjectId,
  toUserId,
  toOrganizationId,
  toParticipationId,
  toEventId,
} from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import type { TaskStatus } from '../values/task-status'
import { staleDays, isStaleTask, isOverdueTask } from './stale'
import { flowMetrics, flowWeeks, flowSnapshot } from './flow'
import { recentChanges, lastActorUpdate } from './recent-changes'

const id = (n: number) => `0000000000000000000000000${n}`
const userId = toUserId(id(1))
const task: Task = {
  ...createTask({
    id: toTaskId(id(1)),
    projectId: toProjectId(id(1)),
    projectName: 'AgileBox',
    organizationId: toOrganizationId(id(1)),
    number: 1,
    createdBy: userId,
    title: 'Revisar tarefa',
    createdAt: '2026-10-25T12:00:00Z',
    responsibleParticipationId: toParticipationId(id(1)),
    responsibleRateCents: 0,
  }),
  status: 'in_progress',
  updatedAt: '2026-11-01T12:00:00Z',
}
function change(
  at: string,
  after: TaskStatus,
  taskId = task.id,
): Extract<TimelineEvent, { readonly type: 'status_changed' }> {
  return {
    id: toEventId(id(1)),
    taskId,
    at,
    actorUserId: userId,
    asManager: false,
    type: 'status_changed',
    payload: { before: 'todo', after },
  }
}
const today = parseDateOnly('2026-11-01')
const window = {
  start: parseDateOnly('2026-10-26'),
  endExclusive: parseDateOnly('2026-11-02'),
  timeZone: 'America/Cuiaba',
}
const now = '2026-11-01T12:00:00Z'

describe('sinais e fluxo v2', () => {
  it('reconstrói estado e última edição no passado sem incluir tarefas ainda não criadas', () => {
    const completed = { ...task, status: 'done' as const, updatedAt: '2026-11-01T12:00:00Z' }
    const future = { ...completed, id: toTaskId(id(2)), createdAt: '2026-11-02T12:00:00Z' }
    const history = [
      change('2026-10-26T12:00:00Z', 'in_progress'),
      {
        ...change('2026-10-31T12:00:00Z', 'done'),
        payload: { before: 'in_progress' as const, after: 'done' as const },
      },
    ]
    const snapshot = flowSnapshot([completed, future], history, '2026-10-30T12:00:00Z')
    expect(snapshot).toHaveLength(1)
    expect(snapshot[0]).toMatchObject({ status: 'in_progress', updatedAt: '2026-10-26T12:00:00Z' })
    expect(completed.status).toBe('done')
  })

  it('gera seis semanas de segunda a domingo inclusive nas viradas de ano', () => {
    const weeks = flowWeeks(parseDateOnly('2026-01-01'), 'UTC')
    expect(weeks).toHaveLength(6)
    expect(weeks[0]).toEqual({ start: '2025-11-24', endExclusive: '2025-12-01', timeZone: 'UTC' })
    expect(weeks[5]).toEqual({ start: '2025-12-29', endExclusive: '2026-01-05', timeZone: 'UTC' })
    expect(flowWeeks(parseDateOnly('2026-01-04'), 'UTC')[5]).toEqual(weeks[5])
    expect(flowWeeks(parseDateOnly('2026-01-05'), 'UTC')[5]?.start).toBe('2026-01-05')
  })

  it('marca parada somente depois de quatro dias de calendário no estado, sem reiniciar por edição comum', () => {
    const events = [change('2026-10-28T23:00:00Z', 'in_progress')]
    expect(staleDays(task, events, today, window.timeZone)).toBe(4)
    expect(isStaleTask(task, events, today, window.timeZone)).toBe(false)
    expect(
      isStaleTask(task, [change('2026-10-27T23:00:00Z', 'in_progress')], today, window.timeZone),
    ).toBe(true)
    expect(isStaleTask({ ...task, status: 'review' }, [], today, window.timeZone)).toBe(true)
    for (const status of ['planning', 'todo', 'done'] as const) {
      expect(staleDays({ ...task, status }, [], today, window.timeZone)).toBeNull()
    }
  })

  it('usa o fuso de calendário e ignora mudanças de outra tarefa', () => {
    const events = [
      change('2026-10-28T02:00:00Z', 'in_progress'),
      change(now, 'review', toTaskId(id(2))),
    ]
    expect(staleDays(task, events, today, window.timeZone)).toBe(5)
    expect(staleDays(task, events, today, 'UTC')).toBe(4)
  })

  it('prazo de hoje não está vencido e tarefa concluída não gera alarme', () => {
    expect(isOverdueTask({ ...task, deadline: today }, today)).toBe(false)
    const overdue = { ...task, deadline: parseDateOnly('2026-10-31') }
    expect(isOverdueTask(overdue, today)).toBe(true)
    expect(isOverdueTask({ ...overdue, status: 'done' }, today)).toBe(false)
    expect(isOverdueTask(task, today)).toBe(false)
  })

  it('calcula ciclo desde a primeira entrada e lead time desde a criação; conta tarefa uma vez na semana', () => {
    const events = [
      change('2026-10-26T12:00:00Z', 'in_progress'),
      change('2026-10-28T12:00:00Z', 'done'),
      change('2026-10-29T12:00:00Z', 'in_progress'),
      change('2026-10-30T12:00:00Z', 'done'),
    ]
    expect(flowMetrics([{ ...task, status: 'done' }], events.reverse(), window, now)).toEqual({
      cycleDays: 4,
      leadDays: 5,
      throughput: 1,
      upToDatePercentage: null,
    })
  })

  it('respeita o intervalo semanal seg a dom, o instante atual e o conjunto autorizado', () => {
    const events = [
      change('2026-10-26T03:59:59Z', 'done'),
      change('2026-11-02T04:00:00Z', 'done'),
      change('2026-10-30T12:00:00Z', 'done', toTaskId(id(2))),
    ]
    expect(flowMetrics([task], events, window, now).throughput).toBe(0)
    expect(
      flowMetrics([task], [change('2026-11-02T03:59:59Z', 'done')], window, '2026-11-02T04:00:00Z')
        .throughput,
    ).toBe(1)
  })

  it('considera 48h exatas como quadro em dia, exclui concluídas e distingue falta de histórico', () => {
    const old = { ...task, id: toTaskId(id(2)), updatedAt: '2026-10-30T11:59:59Z' }
    const boundary = { ...task, updatedAt: '2026-10-30T12:00:00Z' }
    const metrics = flowMetrics(
      [boundary, old, { ...task, id: toTaskId(id(3)), status: 'done' }],
      [],
      window,
      now,
    )
    expect(metrics).toEqual({
      cycleDays: null,
      leadDays: null,
      throughput: 0,
      upToDatePercentage: 50,
    })
    expect(flowMetrics([], [], window, now).upToDatePercentage).toBeNull()
  })

  it('retorna até cinco mudanças recentes em ordem e a última edição feita pelo ator', () => {
    const events = [
      change('2026-10-31T12:00:00Z', 'review'),
      change('2026-11-01T11:00:00Z', 'done'),
      change('2026-11-02T12:00:00Z', 'todo'),
      change(now, 'done', toTaskId(id(2))),
    ]
    expect(
      recentChanges([task], events, '2026-10-31T00:00:00Z', now).map((event) => event.at),
    ).toEqual(['2026-11-01T11:00:00Z', '2026-10-31T12:00:00Z'])
    expect(recentChanges([task], events, '2026-10-31T00:00:00Z', now, 1)).toHaveLength(1)
    expect(recentChanges([], events, '2026-10-31T00:00:00Z', now)).toEqual([])
    expect(lastActorUpdate([task], events.slice(0, 2), userId)).toBe('2026-11-01T11:00:00Z')
    expect(lastActorUpdate([task], events, toUserId(id(2)))).toBeNull()
  })
})
