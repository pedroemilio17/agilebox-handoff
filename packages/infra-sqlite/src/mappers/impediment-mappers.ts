import { toImpedimentId, toOrganizationId, toTaskId, toUserId } from '@agilebox/core'
import type { Impediment, ImpedimentStatus } from '@agilebox/core'
import type { taskImpediments } from '../schema/index.js'

type ImpedimentRow = typeof taskImpediments.$inferSelect

/** Linha de `task_impediments` para o domínio. Nulos continuam nulos; ids passam pelos conversores. */
export function mapImpedimentRow(row: ImpedimentRow): Impediment {
  return {
    id: toImpedimentId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    taskId: toTaskId(row.taskId),
    reason: row.reason,
    status: row.status as ImpedimentStatus,
    ownerId: row.ownerId === null ? null : toUserId(row.ownerId),
    openedBy: toUserId(row.openedBy),
    openedAt: row.openedAt,
    resolvedBy: row.resolvedBy === null ? null : toUserId(row.resolvedBy),
    resolvedAt: row.resolvedAt,
    resolution: row.resolution,
  }
}
