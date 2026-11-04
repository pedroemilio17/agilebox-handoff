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
  'checklist_item_added',
  'checklist_item_done',
  'checklist_item_reopened',
  'checklist_item_removed',
  'hours_changed',
  'rate_changed',
  'participant_added',
  'participant_removed',
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
