import type { EventId, TaskId, UserId } from '../shared/ids'
import type { DateOnly } from '../values/date-only'
import type { ParticipationRole } from '../values/role'
import type { TaskPriority } from '../values/task-priority'
import type { TaskStatus } from '../values/task-status'
import type { Ticket } from '../values/ticket'
import type { Participant } from './participation'

interface EventBase {
  readonly id: EventId
  readonly taskId: TaskId
  readonly at: string
  readonly actorUserId: UserId
  readonly asManager: boolean
}
type Change<T> = { readonly before: T; readonly after: T }
type ParticipantChange = { readonly participant: Participant; readonly role: ParticipationRole }
type ParticipantValueChange = Change<number> & { readonly participant: Participant }

export type TimelineEvent = EventBase &
  (
    | {
        readonly type: 'task_created' | 'progress_confirmed'
        readonly payload: Record<string, never>
      }
    | { readonly type: 'status_changed'; readonly payload: Change<TaskStatus> }
    | { readonly type: 'priority_changed'; readonly payload: Change<TaskPriority> }
    | { readonly type: 'blocked'; readonly payload: { readonly reason: string } }
    | { readonly type: 'unblocked'; readonly payload: { readonly reason: string } }
    | { readonly type: 'deadline_changed'; readonly payload: Change<DateOnly | null> }
    | { readonly type: 'renamed' | 'description_edited'; readonly payload: Change<string> }
    | { readonly type: 'responsible_changed'; readonly payload: Change<UserId> }
    | { readonly type: 'ticket_changed'; readonly payload: Change<Ticket | null> }
    | { readonly type: 'hours_changed' | 'rate_changed'; readonly payload: ParticipantValueChange }
    | {
        readonly type: 'participant_added' | 'participant_removed'
        readonly payload: ParticipantChange
      }
  )

export function createTimelineEvent(event: TimelineEvent): TimelineEvent {
  return { ...event, payload: { ...event.payload } } as TimelineEvent
}
