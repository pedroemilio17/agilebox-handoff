import { and, asc, eq, gte, lt, sql } from 'drizzle-orm'
import type { MeetingRepository } from '@agilebox/application'
import type { Meeting, OrganizationId, UserId } from '@agilebox/core'
import { toMeetingId, toOrganizationId, toUserId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { meetingParticipants, meetings, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>
type MeetingRow = typeof meetings.$inferSelect

function mapMeetingRow(row: MeetingRow, participants: readonly UserId[]): Meeting {
  return {
    id: toMeetingId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    title: row.title,
    date: row.date as Meeting['date'],
    time: row.time,
    participants,
    createdBy: toUserId(row.createdBy),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function createSqliteMeetingRepository(database: SqliteDatabase): MeetingRepository {
  async function mapRows(rows: readonly MeetingRow[]): Promise<readonly Meeting[]> {
    const result: Meeting[] = []
    for (const row of rows) {
      const participants = await database
        .select({ userId: meetingParticipants.userId })
        .from(meetingParticipants)
        .where(eq(meetingParticipants.meetingId, row.id))
        .orderBy(asc(meetingParticipants.userId))
      result.push(
        mapMeetingRow(
          row,
          participants.map((participant) => toUserId(participant.userId)),
        ),
      )
    }
    return result
  }

  return {
    async findById(organizationId, meetingId) {
      const [row] = await database
        .select()
        .from(meetings)
        .where(and(eq(meetings.organizationId, organizationId), eq(meetings.id, meetingId)))
        .limit(1)
      if (!row) return null
      const [meeting] = await mapRows([row])
      return meeting ?? null
    },
    async listByMonth(organizationId, month) {
      const year = Number(month.slice(0, 4))
      const monthNumber = Number(month.slice(5, 7))
      const start = `${month}-01`
      const end = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10)
      const rows = await database
        .select()
        .from(meetings)
        .where(
          and(
            eq(meetings.organizationId, organizationId),
            gte(meetings.date, start),
            lt(meetings.date, end),
          ),
        )
        .orderBy(asc(meetings.date), asc(meetings.time))
      return mapRows(rows)
    },
    async listUpcoming(organizationId, today) {
      const rows = await database
        .select()
        .from(meetings)
        .where(and(eq(meetings.organizationId, organizationId), gte(meetings.date, today)))
        .orderBy(asc(meetings.date), asc(meetings.time))
      return mapRows(rows)
    },
    async save(organizationId, meeting) {
      const [creator] = await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, meeting.createdBy), eq(users.organizationId, organizationId)))
        .limit(1)
      if (!creator) return
      const validParticipants = await Promise.all(
        meeting.participants.map(async (userId) => {
          const [participant] = await database
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)))
            .limit(1)
          return participant !== undefined
        }),
      )
      if (!validParticipants.every(Boolean)) return
      const [existingMeeting] = await database
        .select({ organizationId: meetings.organizationId })
        .from(meetings)
        .where(eq(meetings.id, meeting.id))
        .limit(1)
      if (existingMeeting && existingMeeting.organizationId !== organizationId) return
      const value = {
        id: meeting.id,
        organizationId,
        title: meeting.title,
        date: meeting.date,
        time: meeting.time,
        createdBy: meeting.createdBy,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
      }
      await database
        .insert(meetings)
        .values(value)
        .onConflictDoUpdate({
          target: meetings.id,
          set: value,
          setWhere: eq(meetings.organizationId, organizationId),
        })
      await database
        .delete(meetingParticipants)
        .where(eq(meetingParticipants.meetingId, meeting.id))
      if (meeting.participants.length)
        await database
          .insert(meetingParticipants)
          .values(meeting.participants.map((userId) => ({ meetingId: meeting.id, userId })))
    },
    async count(organizationId) {
      const [row] = await database
        .select({ value: sql<number>`count(*)` })
        .from(meetings)
        .where(eq(meetings.organizationId, organizationId))
      return Number(row?.value ?? 0)
    },
    async remove(organizationId: OrganizationId, meetingId) {
      const [meeting] = await database
        .select({ id: meetings.id })
        .from(meetings)
        .where(and(eq(meetings.organizationId, organizationId), eq(meetings.id, meetingId)))
        .limit(1)
      if (!meeting) return
      await database.delete(meetingParticipants).where(eq(meetingParticipants.meetingId, meetingId))
      await database
        .delete(meetings)
        .where(and(eq(meetings.organizationId, organizationId), eq(meetings.id, meetingId)))
    },
  }
}
