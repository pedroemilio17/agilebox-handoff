import {
  createRetroAction,
  parseDateOnly,
  toMeetingId,
  toOrganizationId,
  toRetroActionId,
  toUserId,
} from '@agilebox/core'
import type { RetroAction } from '@agilebox/core'
import type { retroActions } from '../schema/index.js'

type RetroActionRow = typeof retroActions.$inferSelect

export function mapRetroActionRow(row: RetroActionRow): RetroAction {
  return createRetroAction({
    id: toRetroActionId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    meetingId: toMeetingId(row.meetingId),
    occurrenceDate: parseDateOnly(row.occurrenceDate),
    title: row.title,
    responsibleId: row.responsibleId === null ? null : toUserId(row.responsibleId),
    dueDate: row.dueDate === null ? null : parseDateOnly(row.dueDate),
    done: row.done,
    doneAt: row.doneAt,
    createdAt: row.createdAt,
    createdBy: toUserId(row.createdBy),
  })
}
