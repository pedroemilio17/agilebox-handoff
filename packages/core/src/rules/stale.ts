import type { Task } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import { diffInDays, toDateOnly, type DateOnly } from '../values/date-only'

/** Calendar days since the last status change; ordinary edits do not reset aging. */
export function staleDays(
  task: Task,
  events: readonly TimelineEvent[],
  today: DateOnly,
  timeZone: string,
): number | null {
  if (task.status !== 'in_progress' && task.status !== 'review') return null
  const changes = events.filter(
    (event) => event.taskId === task.id && event.type === 'status_changed',
  )
  const latest = changes.reduce(
    (at, event) => (Date.parse(event.at) > Date.parse(at) ? event.at : at),
    task.createdAt,
  )
  return Math.max(0, diffInDays(toDateOnly(new Date(latest), timeZone), today))
}

export function isStaleTask(
  task: Task,
  events: readonly TimelineEvent[],
  today: DateOnly,
  timeZone: string,
): boolean {
  const days = staleDays(task, events, today, timeZone)
  return days !== null && days > 4
}

export function isOverdueTask(task: Task, today: DateOnly): boolean {
  return task.status !== 'done' && task.deadline !== null && task.deadline < today
}
