import type { EventId, TaskId, UserId } from '../shared/ids'
import type { DateOnly } from '../values/date-only'
import type { ParticipationRole } from '../values/role'
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
type CriterionText = { readonly text: string }

export type TimelineEvent = EventBase &
  (
    | {
        readonly type:
          | 'task_created'
          | 'progress_confirmed'
          | 'archived'
          | 'unarchived'
          | 'moved_to_board'
          | 'sent_to_backlog'
        readonly payload: Record<string, never>
      }
    | { readonly type: 'status_changed'; readonly payload: Change<TaskStatus> }
    | { readonly type: 'deadline_changed'; readonly payload: Change<DateOnly | null> }
    | { readonly type: 'renamed' | 'description_edited'; readonly payload: Change<string> }
    | { readonly type: 'responsible_changed'; readonly payload: Change<UserId> }
    | { readonly type: 'ticket_changed'; readonly payload: Change<Ticket | null> }
    | { readonly type: 'hours_changed' | 'rate_changed'; readonly payload: ParticipantValueChange }
    | {
        readonly type: 'participant_added' | 'participant_removed'
        readonly payload: ParticipantChange
      }
    /** Texto do critério depois da mudança (sem o texto anterior: payload mínimo). */
    | {
        readonly type: 'criterion_added' | 'criterion_edited' | 'criterion_removed'
        readonly payload: CriterionText
      }
    | {
        readonly type: 'criterion_done_changed'
        readonly payload: CriterionText & { readonly done: boolean }
      }
    /** Estimativa em centésimos de hora, nunca em custo. Nulo = sem estimativa. */
    | { readonly type: 'estimate_changed'; readonly payload: Change<number | null> }
  )

export function createTimelineEvent(event: TimelineEvent): TimelineEvent {
  return { ...event, payload: { ...event.payload } } as TimelineEvent
}
