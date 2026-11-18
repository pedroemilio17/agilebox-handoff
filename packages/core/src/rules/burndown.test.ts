import { describe, expect, it } from 'vitest'
import { createSprintTask, closeSprintTask } from '../entities/sprint-task'
import type { SprintTask } from '../entities/sprint-task'
import { createTask } from '../entities/task'
import type { Task } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import type { TaskStatus } from '../values/task-status'
import {
  toEventId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toSprintId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import { averageVelocity, burndownSeries, sprintScope, sprintVelocityHours } from './burndown'

const id = (n: number) => String(n).padStart(26, '0')
const org = toOrganizationId(id(1))
const project = toProjectId(id(1))
const actor = toUserId(id(2))
const TZ = 'America/Sao_Paulo'
/** Meio-dia em São Paulo: sempre cai no dia certo. */
const noon = (day: string) => `${day}T15:00:00.000Z`

function task(
  n: number,
  hours: number | null,
  options: { status?: TaskStatus; archived?: boolean } = {},
): Task {
  const base = createTask({
    id: toTaskId(id(100 + n)),
    organizationId: org,
    number: n,
    projectId: project,
    projectName: 'Projeto',
    createdBy: actor,
    title: `Tarefa ${n}`,
    createdAt: noon('2026-11-01'),
    responsibleParticipationId: toParticipationId(id(300 + n)),
    responsibleRateCents: 0,
  })
  return {
    ...base,
    status: options.status ?? 'planning',
    estimatedHoursHundredths: hours === null ? null : hours * 100,
    archivedAt: options.archived ? noon('2026-11-05') : null,
  }
}

let eventSeq = 0

function statusEvent(n: number, at: string, before: TaskStatus, after: TaskStatus): TimelineEvent {
  return {
    id: toEventId(id(500 + eventSeq++)),
    taskId: toTaskId(id(100 + n)),
    at,
    actorUserId: actor,
    asManager: false,
    type: 'status_changed',
    payload: { before, after },
  }
}

function row(n: number, sprintNumber: number, outcome: SprintTask['outcome'] = 'open'): SprintTask {
  const created = createSprintTask({
    sprintId: toSprintId(id(700 + sprintNumber)),
    organizationId: org,
    taskId: toTaskId(id(100 + n)),
    addedAt: noon('2026-11-09'),
    addedBy: actor,
  })
  return outcome === 'open' ? created : { ...created, removedAt: noon('2026-11-10'), outcome }
}

const SPRINT = {
  plannedStart: parseDateOnly('2026-11-09'),
  plannedEnd: parseDateOnly('2026-11-11'),
}

describe('sprintScope', () => {
  it('deixa de fora arquivadas e tarefas que saíram da sprint, mas mantém quem voltou', () => {
    const tasks = [task(1, 2), task(2, 3, { archived: true }), task(3, 1), task(4, 5)]
    const rows = [
      row(1, 1),
      row(2, 1),
      row(3, 1, 'removed'),
      row(4, 1, 'removed'),
      row(4, 1), // voltou: a linha aberta conta
    ]
    expect(sprintScope(tasks, rows).map((item) => item.number)).toEqual([1, 4])
  })

  it('a linha fechada no encerramento continua no escopo', () => {
    const closed = closeSprintTask(row(1, 1), 'completed', noon('2026-11-11'), actor)
    expect(sprintScope([task(1, 2)], [closed]).map((item) => item.number)).toEqual([1])
  })
})

describe('burndownSeries', () => {
  // 4 + 2 + 6 = 12 h estimadas; a tarefa 4 não tem estimativa.
  const scope = [task(1, 4), task(2, 2), task(3, 6), task(4, null)]

  it('abre as horas a cada conclusão e mede só até o dia de hoje', () => {
    const events = [
      statusEvent(1, noon('2026-11-10'), 'in_progress', 'done'),
      statusEvent(2, noon('2026-11-11'), 'review', 'done'),
    ]
    const series = burndownSeries({
      ...SPRINT,
      scope,
      events,
      measuredUntil: parseDateOnly('2026-11-10'),
      timeZone: TZ,
    })
    expect(series.days.map((day) => day.remainingHours)).toEqual([12, 8, null])
    expect(series.days.map((day) => day.idealHours)).toEqual([12, 6, 0])
    expect(series.totalHours).toBe(12)
    expect(series.remainingHours).toBe(8)
    expect(series.scopeTasks).toBe(4)
    expect(series.doneTasks).toBe(1)
    expect(series.unestimatedTasks).toBe(1)
  })

  it('reabrir uma tarefa devolve as horas ao restante no dia seguinte', () => {
    const events = [
      statusEvent(1, noon('2026-11-09'), 'in_progress', 'done'),
      statusEvent(1, noon('2026-11-10'), 'done', 'review'),
    ]
    const series = burndownSeries({
      ...SPRINT,
      scope: [task(1, 4)],
      events,
      measuredUntil: parseDateOnly('2026-11-11'),
      timeZone: TZ,
    })
    expect(series.days.map((day) => day.remainingHours)).toEqual([0, 4, 4])
  })

  it('usa o estado anterior ao primeiro evento antes dele', () => {
    const events = [statusEvent(1, noon('2026-11-10'), 'in_progress', 'done')]
    const series = burndownSeries({
      ...SPRINT,
      scope: [task(1, 4, { status: 'done' })],
      events,
      measuredUntil: parseDateOnly('2026-11-11'),
      timeZone: TZ,
    })
    // Antes do primeiro evento a tarefa estava em andamento: 4 h abertas no dia 9.
    expect(series.days.map((day) => day.remainingHours)).toEqual([4, 0, 0])
  })

  it('sem nenhum dia medido, o restante é o total e nenhum ponto tem valor', () => {
    const series = burndownSeries({
      ...SPRINT,
      scope,
      events: [],
      measuredUntil: parseDateOnly('2026-11-01'),
      timeZone: TZ,
    })
    expect(series.days.every((day) => day.remainingHours === null)).toBe(true)
    expect(series.remainingHours).toBe(12)
  })

  it('sprint de um dia: a linha ideal vai direto a zero', () => {
    const series = burndownSeries({
      plannedStart: parseDateOnly('2026-11-09'),
      plannedEnd: parseDateOnly('2026-11-09'),
      scope: [task(1, 4)],
      events: [],
      measuredUntil: parseDateOnly('2026-11-09'),
      timeZone: TZ,
    })
    expect(series.days).toEqual([{ date: '2026-11-09', idealHours: 0, remainingHours: 4 }])
  })

  it('o dia é o do fuso, não o do UTC', () => {
    // 01:30 UTC de 11/11 ainda é 10/11 em São Paulo.
    const events = [statusEvent(1, '2026-11-11T01:30:00.000Z', 'review', 'done')]
    const series = burndownSeries({
      ...SPRINT,
      scope: [task(1, 4)],
      events,
      measuredUntil: parseDateOnly('2026-11-11'),
      timeZone: TZ,
    })
    expect(series.days.map((day) => day.remainingHours)).toEqual([4, 0, 0])
  })
})

describe('velocidade', () => {
  it('soma as horas concluídas até o fim do dia do encerramento', () => {
    const scope = [task(1, 4), task(2, 2), task(3, 6)]
    const events = [
      statusEvent(1, noon('2026-11-10'), 'review', 'done'),
      statusEvent(2, noon('2026-11-12'), 'review', 'done'),
    ]
    expect(
      sprintVelocityHours({ closedDay: parseDateOnly('2026-11-11'), scope, events, timeZone: TZ }),
    ).toBe(4)
    expect(
      sprintVelocityHours({ closedDay: parseDateOnly('2026-11-12'), scope, events, timeZone: TZ }),
    ).toBe(6)
  })

  it('média das últimas sprints encerradas, no máximo três, pela numeração', () => {
    const points = [
      { sprintNumber: 1, hours: 10 },
      { sprintNumber: 2, hours: 20 },
      { sprintNumber: 3, hours: 30 },
      { sprintNumber: 4, hours: 50 },
    ]
    expect(averageVelocity(points)).toBe(33.33)
    expect(averageVelocity(points.slice(0, 2))).toBe(15)
  })

  it('sem sprint encerrada, a média é nula', () => {
    expect(averageVelocity([])).toBeNull()
  })
})
