import {
  createDailyEntry,
  toDailyEntryId,
  toOrganizationId,
  toTaskId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { DailyEntry } from '@agilebox/core'
import type { dailyEntries } from '../schema/index.js'

type DailyEntryRow = typeof dailyEntries.$inferSelect

/** `task_refs` é JSON de strings. Valor fora do formato é erro de dados, não é ignorado. */
function parseTaskRefs(raw: string) {
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string'))
    throw new ValidationError('Tarefas citadas inválidas na daily')
  return parsed.map((item) => toTaskId(item))
}

export function mapDailyEntryRow(row: DailyEntryRow): DailyEntry {
  return createDailyEntry({
    id: toDailyEntryId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    userId: toUserId(row.userId),
    date: row.date,
    answers: { progress: row.progress, nextStep: row.nextStep, blocker: row.blocker },
    noNews: row.noNews,
    taskRefs: parseTaskRefs(row.taskRefs),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}
