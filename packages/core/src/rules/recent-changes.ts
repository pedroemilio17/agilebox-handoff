import type { Task } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import type { UserId } from '../shared/ids'

/** Only events for tasks already authorized by the application are returned. */
export function recentChanges(
  tasks: readonly Task[],
  events: readonly TimelineEvent[],
  since: string,
  now: string,
  limit = 5,
): readonly TimelineEvent[] {
  const ids = new Set(tasks.map((task) => task.id))
  return events
    .filter(
      (event) =>
        ids.has(event.taskId) &&
        Date.parse(event.at) >= Date.parse(since) &&
        Date.parse(event.at) <= Date.parse(now),
    )
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, Math.max(0, limit))
}

export function lastActorUpdate(
  tasks: readonly Task[],
  events: readonly TimelineEvent[],
  userId: UserId,
): string | null {
  const ids = new Set(tasks.map((task) => task.id))
  return events
    .filter((event) => ids.has(event.taskId) && event.actorUserId === userId)
    .reduce<string | null>(
      (latest, event) =>
        latest === null || Date.parse(event.at) > Date.parse(latest) ? event.at : latest,
      null,
    )
}
