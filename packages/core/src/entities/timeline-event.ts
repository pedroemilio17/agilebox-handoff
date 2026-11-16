import type {
  AcceptanceCriterionId,
  ChecklistItemId,
  EventId,
  TaskCommentId,
  TaskId,
  UserId,
} from '../shared/ids'
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
    | {
        readonly type:
          | 'checklist_item_added'
          | 'checklist_item_done'
          | 'checklist_item_reopened'
          | 'checklist_item_removed'
        readonly payload: { readonly itemId: ChecklistItemId; readonly title: string }
      }
    | {
        readonly type:
          | 'acceptance_criterion_added'
          | 'acceptance_criterion_removed'
          | 'acceptance_criterion_done'
          | 'acceptance_criterion_reopened'
        readonly payload: { readonly criterionId: AcceptanceCriterionId; readonly text: string }
      }
    | {
        readonly type: 'acceptance_criterion_renamed'
        readonly payload: Change<string> & { readonly criterionId: AcceptanceCriterionId }
      }
    | {
        readonly type: 'acceptance_criterion_moved'
        readonly payload: Change<number> & {
          readonly criterionId: AcceptanceCriterionId
          readonly text: string
        }
      }
    | { readonly type: 'estimate_changed'; readonly payload: Change<number | null> }
    | {
        readonly type: 'comment_added'
        readonly payload: { readonly commentId: TaskCommentId; readonly excerpt: string }
      }
    | { readonly type: 'comment_removed'; readonly payload: { readonly commentId: TaskCommentId } }
    | { readonly type: 'definition_confirmed'; readonly payload: { readonly count: number } }
    | {
        readonly type: 'task_archived' | 'task_unarchived'
        readonly payload: Record<string, never>
      }
    | {
        readonly type: 'task_added_to_backlog' | 'task_sent_to_backlog'
        readonly payload: Record<string, never>
      }
    | {
        readonly type: 'task_pulled_from_backlog'
        readonly payload: { readonly status: TaskStatus }
      }
    | { readonly type: 'task_reordered'; readonly payload: { readonly position: number } }
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
