import {
  parseDateOnly,
  toBaselineId,
  toOrganizationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Baseline, BaselineTask, DateOnly } from '@agilebox/core'
import type { baselineTasks, baselines } from '../schema/index.js'

type BaselineRow = typeof baselines.$inferSelect
type BaselineTaskRow = typeof baselineTasks.$inferSelect

function dateOrNull(value: string | null): DateOnly | null {
  return value === null ? null : parseDateOnly(value)
}

export function mapBaselineTaskRow(row: BaselineTaskRow): BaselineTask {
  return {
    taskId: toTaskId(row.taskId),
    title: row.title,
    startsOn: dateOrNull(row.startsOn),
    endsOn: dateOrNull(row.endsOn),
    estimatedHoursHundredths: row.estimatedHoursHundredths,
    plannedCostCents: row.plannedCostCents,
  }
}

/** Foto com as tarefas já lidas (a ordem vem do repositório). */
export function mapBaselineRow(row: BaselineRow, tasks: readonly BaselineTaskRow[]): Baseline {
  return {
    id: toBaselineId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    projectId: toProjectId(row.projectId),
    name: row.name,
    takenAt: row.takenAt,
    takenBy: toUserId(row.takenBy),
    tasks: tasks.map(mapBaselineTaskRow),
  }
}
