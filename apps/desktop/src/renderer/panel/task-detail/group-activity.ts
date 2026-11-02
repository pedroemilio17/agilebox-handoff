import { format } from 'date-fns'
import type { TimelineEventDto } from '@agilebox/contract'

/** Presentation only: preserve every event, grouping consecutive edits by person, role and day. */
export function groupActivity(events: readonly TimelineEventDto[]): TimelineEventDto[][] {
  const groups: TimelineEventDto[][] = []
  for (const event of [...events].sort((a, b) => b.at.localeCompare(a.at))) {
    const previous = groups.at(-1)
    const first = previous?.[0]
    if (
      first &&
      first.actorUserId === event.actorUserId &&
      first.asManager === event.asManager &&
      format(new Date(first.at), 'yyyy-MM-dd') === format(new Date(event.at), 'yyyy-MM-dd')
    )
      previous.push(event)
    else groups.push([event])
  }
  return groups
}
