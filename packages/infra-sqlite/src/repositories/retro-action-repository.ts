import { and, asc, eq, inArray } from 'drizzle-orm'
import type { RetroActionRepository } from '@agilebox/application'
import type {
  DateOnly,
  MeetingId,
  OrganizationId,
  RetroAction,
  RetroActionId,
} from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapRetroActionRow } from '../mappers/retro-action-mappers.js'
import { meetings, retroActions, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

export function createSqliteRetroActionRepository(database: SqliteDatabase): RetroActionRepository {
  return {
    async findById(organizationId: OrganizationId, actionId: RetroActionId) {
      const [row] = await database
        .select()
        .from(retroActions)
        .where(and(eq(retroActions.id, actionId), eq(retroActions.organizationId, organizationId)))
        .limit(1)
      return row ? mapRetroActionRow(row) : null
    },
    async listByOccurrence(
      organizationId: OrganizationId,
      meetingId: MeetingId,
      occurrenceDate: DateOnly,
    ) {
      const rows = await database
        .select()
        .from(retroActions)
        .where(
          and(
            eq(retroActions.organizationId, organizationId),
            eq(retroActions.meetingId, meetingId),
            eq(retroActions.occurrenceDate, occurrenceDate),
          ),
        )
        .orderBy(asc(retroActions.createdAt), asc(retroActions.id))
      return rows.map(mapRetroActionRow)
    },
    async listByMeetings(organizationId: OrganizationId, meetingIds: readonly MeetingId[]) {
      if (meetingIds.length === 0) return []
      const rows = await database
        .select()
        .from(retroActions)
        .where(
          and(
            eq(retroActions.organizationId, organizationId),
            inArray(retroActions.meetingId, [...meetingIds]),
          ),
        )
        .orderBy(asc(retroActions.createdAt), asc(retroActions.id))
      return rows.map(mapRetroActionRow)
    },
    async save(organizationId: OrganizationId, action: RetroAction) {
      // Só grava combinado de agendamento e de usuários desta organização.
      const [meeting] = await database
        .select({ id: meetings.id })
        .from(meetings)
        .where(and(eq(meetings.id, action.meetingId), eq(meetings.organizationId, organizationId)))
        .limit(1)
      const [creator] = await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, action.createdBy), eq(users.organizationId, organizationId)))
        .limit(1)
      if (!meeting || !creator) return
      if (action.responsibleId !== null) {
        const [responsible] = await database
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, action.responsibleId), eq(users.organizationId, organizationId)))
          .limit(1)
        if (!responsible) return
      }
      const value = {
        id: action.id,
        organizationId,
        meetingId: action.meetingId,
        occurrenceDate: action.occurrenceDate,
        title: action.title,
        responsibleId: action.responsibleId,
        dueDate: action.dueDate,
        done: action.done,
        doneAt: action.doneAt,
        createdAt: action.createdAt,
        createdBy: action.createdBy,
      }
      await database
        .insert(retroActions)
        .values(value)
        .onConflictDoUpdate({
          target: retroActions.id,
          set: {
            title: value.title,
            responsibleId: value.responsibleId,
            dueDate: value.dueDate,
            done: value.done,
            doneAt: value.doneAt,
          },
          where: eq(retroActions.organizationId, organizationId),
        })
    },
    async remove(organizationId: OrganizationId, actionId: RetroActionId) {
      await database
        .delete(retroActions)
        .where(and(eq(retroActions.id, actionId), eq(retroActions.organizationId, organizationId)))
    },
  }
}
