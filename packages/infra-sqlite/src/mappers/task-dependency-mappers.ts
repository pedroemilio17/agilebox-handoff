import { toOrganizationId, toTaskId, toUserId } from '@agilebox/core'
import type { TaskDependency } from '@agilebox/core'
import type { taskDependencies } from '../schema/index.js'

type DependencyRow = typeof taskDependencies.$inferSelect

export function mapTaskDependencyRow(row: DependencyRow): TaskDependency {
  return {
    organizationId: toOrganizationId(row.organizationId),
    predecessorId: toTaskId(row.predecessorId),
    successorId: toTaskId(row.successorId),
    createdAt: row.createdAt,
    createdBy: toUserId(row.createdBy),
  }
}
