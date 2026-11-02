import type { Task } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import { toDateOnly, type DateOnly } from '../values/date-only'

export interface FlowWindow {
  readonly start: DateOnly
  readonly endExclusive: DateOnly
  readonly timeZone: string
}
export interface FlowMetrics {
  readonly cycleDays: number | null
  readonly leadDays: number | null
  readonly throughput: number
  readonly upToDatePercentage: number | null
}

/** Inputs must already be scoped by the application access policy. Events of other tasks are ignored. */
export function flowMetrics(
  tasks: readonly Task[],
  events: readonly TimelineEvent[],
  window: FlowWindow,
  now: string,
): FlowMetrics {
  const nowMs = Date.parse(now)
  const cycles: number[] = []
  const leads: number[] = []
  let throughput = 0
  for (const task of tasks) {
    const history = events
      .filter((event) => event.taskId === task.id && Date.parse(event.at) <= nowMs)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    const completed = [...history].reverse().find((event) => {
      if (event.type !== 'status_changed' || event.payload.after !== 'done') return false
      const day = toDateOnly(new Date(event.at), window.timeZone)
      return day >= window.start && day < window.endExclusive
    })
    if (!completed) continue
    throughput++
    const completedMs = Date.parse(completed.at)
    const firstStarted = history.find(
      (event) =>
        event.type === 'status_changed' &&
        event.payload.after === 'in_progress' &&
        Date.parse(event.at) <= completedMs,
    )
    if (firstStarted) cycles.push((completedMs - Date.parse(firstStarted.at)) / 86_400_000)
    const lead = (completedMs - Date.parse(task.createdAt)) / 86_400_000
    if (lead >= 0) leads.push(lead)
  }
  const active = tasks.filter((task) => task.status !== 'done')
  const updated = active.filter((task) => {
    const age = nowMs - Date.parse(task.updatedAt)
    return age >= 0 && age <= 48 * 3_600_000
  }).length
  const average = (values: readonly number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  return {
    cycleDays: average(cycles),
    leadDays: average(leads),
    throughput,
    upToDatePercentage: active.length ? (updated / active.length) * 100 : null,
  }
}

/** Six calendar weeks, Monday inclusive through next Monday exclusive. */
export function flowWeeks(today: DateOnly, timeZone: string): FlowWindow[] {
  const date = new Date(`${today}T12:00:00Z`)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset - 35)
  const weeks: FlowWindow[] = []
  for (let index = 0; index < 6; index++) {
    const start = toDateOnly(date, 'UTC')
    date.setUTCDate(date.getUTCDate() + 7)
    weeks.push({ start, endExclusive: toDateOnly(date, 'UTC'), timeZone })
  }
  return weeks
}

/** Reconstruct only the fields used for flow/adoption, undoing changes after the snapshot. */
export function flowSnapshot(
  tasks: readonly Task[],
  events: readonly TimelineEvent[],
  at: string,
): Task[] {
  const instant = Date.parse(at)
  return tasks
    .filter((task) => Date.parse(task.createdAt) <= instant)
    .map((task) => {
      const history = events
        .filter((event) => event.taskId === task.id)
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      let status = task.status
      for (const event of history) {
        if (Date.parse(event.at) > instant && event.type === 'status_changed')
          status = event.payload.before
      }
      const lastEvent = history.find((event) => Date.parse(event.at) <= instant)
      const updatedAt =
        Date.parse(task.updatedAt) <= instant ? task.updatedAt : (lastEvent?.at ?? task.createdAt)
      return { ...task, status, updatedAt }
    })
}
