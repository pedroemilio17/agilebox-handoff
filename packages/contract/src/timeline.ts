import { z } from 'zod'
import { isoDateTimeSchema, ulidSchema } from './shared-schemas'

export const timelineEventTypeSchema = z.enum([
  'task_created',
  'progress_confirmed',
  'status_changed',
  'deadline_changed',
  'renamed',
  'description_edited',
  'responsible_changed',
  'ticket_changed',
  'priority_changed',
  'blocked',
  'unblocked',
  'impediment_assigned',
  'task_archived',
  'task_unarchived',
  'task_added_to_backlog',
  'task_pulled_from_backlog',
  'task_sent_to_backlog',
  'task_reordered',
  'definition_confirmed',
  'checklist_item_added',
  'checklist_item_done',
  'checklist_item_reopened',
  'checklist_item_removed',
  'acceptance_criterion_added',
  'acceptance_criterion_removed',
  'acceptance_criterion_done',
  'acceptance_criterion_reopened',
  'acceptance_criterion_renamed',
  'acceptance_criterion_moved',
  'estimate_changed',
  'comment_added',
  'comment_removed',
  'hours_changed',
  'rate_changed',
  'participant_added',
  'participant_removed',
  'task_added_to_sprint',
  'task_removed_from_sprint',
])

export const timelineEventDtoSchema = z.object({
  id: ulidSchema,
  taskId: ulidSchema,
  at: isoDateTimeSchema,
  actorUserId: ulidSchema,
  asManager: z.boolean(),
  type: timelineEventTypeSchema,
  text: z.string().trim().min(1),
})

export const listTimelineInputSchema = z.object({ taskId: ulidSchema })
export const listTimelineOutputSchema = z.array(timelineEventDtoSchema)

export type TimelineEventDto = z.infer<typeof timelineEventDtoSchema>
