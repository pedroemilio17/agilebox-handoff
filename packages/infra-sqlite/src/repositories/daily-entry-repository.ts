import { and, eq, inArray } from 'drizzle-orm'
import type { DailyEntryRepository } from '@agilebox/application'
import type { DailyEntry, DateOnly, OrganizationId, UserId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapDailyEntryRow } from '../mappers/daily-entry-mappers.js'
import { dailyEntries, tasks, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

export function createSqliteDailyEntryRepository(database: SqliteDatabase): DailyEntryRepository {
  return {
    async findByUserAndDate(organizationId: OrganizationId, userId: UserId, date: DateOnly) {
      const [row] = await database
        .select()
        .from(dailyEntries)
        .where(
          and(
            eq(dailyEntries.organizationId, organizationId),
            eq(dailyEntries.userId, userId),
            eq(dailyEntries.date, date),
          ),
        )
        .limit(1)
      return row ? mapDailyEntryRow(row) : null
    },
    async listByDate(organizationId: OrganizationId, date: DateOnly) {
      const rows = await database
        .select()
        .from(dailyEntries)
        .where(and(eq(dailyEntries.organizationId, organizationId), eq(dailyEntries.date, date)))
      return rows.map(mapDailyEntryRow)
    },
    async save(organizationId: OrganizationId, entry: DailyEntry) {
      // Só grava daily de usuário desta organização, e só cita tarefas desta organização.
      const [user] = await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, entry.userId), eq(users.organizationId, organizationId)))
        .limit(1)
      if (!user) return
      if (entry.taskRefs.length > 0) {
        const found = await database
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(eq(tasks.organizationId, organizationId), inArray(tasks.id, [...entry.taskRefs])),
          )
        if (found.length !== new Set(entry.taskRefs).size) return
      }
      const value = {
        id: entry.id,
        organizationId,
        userId: entry.userId,
        date: entry.date,
        progress: entry.answers.progress,
        nextStep: entry.answers.nextStep,
        blocker: entry.answers.blocker,
        noNews: entry.noNews,
        taskRefs: JSON.stringify(entry.taskRefs),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }
      await database
        .insert(dailyEntries)
        .values(value)
        .onConflictDoUpdate({
          target: dailyEntries.id,
          set: {
            progress: value.progress,
            nextStep: value.nextStep,
            blocker: value.blocker,
            noNews: value.noNews,
            taskRefs: value.taskRefs,
            updatedAt: value.updatedAt,
          },
          where: eq(dailyEntries.organizationId, organizationId),
        })
    },
  }
}
