import { describe, expect, it } from 'vitest'
import { createTask, type Task } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import {
  toEventId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import { FLOW_TREND_WEEKS, flowSeries, flowWeeks } from './flow'

const id = (n: number) => String(n).padStart(26, '0')
const userId = toUserId(id(1))

function makeTask(n: number): Task {
  return {
    ...createTask({
      id: toTaskId(id(n)),
      projectId: toProjectId(id(1)),
      projectName: 'AgileBox',
      organizationId: toOrganizationId(id(1)),
      number: n,
      createdBy: userId,
      title: `Tarefa ${n}`,
      createdAt: '2026-10-01T12:00:00Z',
      responsibleParticipationId: toParticipationId(id(n)),
      responsibleRateCents: 0,
    }),
    status: 'done',
    updatedAt: '2026-10-01T12:00:00Z',
  }
}

function doneAt(at: string, taskNumber: number): TimelineEvent {
  return {
    id: toEventId(id(20 + taskNumber)),
    taskId: toTaskId(id(taskNumber)),
    at,
    actorUserId: userId,
    asManager: false,
    type: 'status_changed',
    payload: { before: 'review', after: 'done' },
  }
}

describe('flowWeeks com contagem', () => {
  it('mantém seis semanas por padrão (série do dashboard)', () => {
    const weeks = flowWeeks(parseDateOnly('2026-11-18'), 'UTC')
    expect(weeks).toHaveLength(6)
    expect(weeks[0]?.start).toBe('2026-10-12')
    expect(weeks[5]).toEqual({ start: '2026-11-16', endExclusive: '2026-11-23', timeZone: 'UTC' })
  })

  it('gera oito semanas terminando na semana de hoje, com a mesma regra de segunda a domingo', () => {
    expect(FLOW_TREND_WEEKS).toBe(8)
    const weeks = flowWeeks(parseDateOnly('2026-11-18'), 'UTC', FLOW_TREND_WEEKS)
    expect(weeks).toHaveLength(8)
    expect(weeks[0]).toEqual({ start: '2026-09-28', endExclusive: '2026-10-05', timeZone: 'UTC' })
    expect(weeks[7]).toEqual({ start: '2026-11-16', endExclusive: '2026-11-23', timeZone: 'UTC' })
    for (let index = 1; index < weeks.length; index++) {
      expect(weeks[index]?.start).toBe(weeks[index - 1]?.endExclusive)
    }
  })
})

describe('flowSeries', () => {
  const weeks = flowWeeks(parseDateOnly('2026-11-01'), 'UTC', 3)
  const now = '2026-11-01T12:00:00Z'

  it('conta cada tarefa na semana da conclusão e não mede nada depois de now', () => {
    const first = makeTask(2)
    const second = makeTask(3)
    const third = makeTask(4)
    const events = [
      doneAt('2026-10-20T12:00:00Z', 2),
      doneAt('2026-10-27T12:00:00Z', 3),
      // Concluída depois de `now`: fora da última semana.
      doneAt('2026-11-01T13:00:00Z', 4),
    ]
    const series = flowSeries([first, second, third], events, weeks, now)

    expect(series.map((week) => week.start)).toEqual(weeks.map((week) => week.start))
    expect(series.map((week) => week.throughput)).toEqual([0, 1, 1])
  })

  it('devolve nulo nas médias de semanas sem conclusão, com o mesmo formato do dashboard', () => {
    const series = flowSeries([makeTask(2)], [], weeks, now)
    expect(series).toHaveLength(3)
    for (const week of series) {
      expect(Object.keys(week).sort()).toEqual([
        'cycleDays',
        'leadDays',
        'start',
        'throughput',
        'upToDatePercentage',
      ])
      // Nenhuma tarefa em aberto: nada a medir de atualização.
      expect(week).toMatchObject({
        cycleDays: null,
        leadDays: null,
        throughput: 0,
        upToDatePercentage: null,
      })
    }
  })
})
