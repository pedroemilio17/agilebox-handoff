import {
  parseDateOnly,
  toDeliverableId,
  toMilestoneId,
  toOrganizationId,
  toProjectId,
  toUserId,
} from '@agilebox/core'
import type { Deliverable, Milestone } from '@agilebox/core'
import type { deliverables, milestones } from '../schema/index.js'

type DeliverableRow = typeof deliverables.$inferSelect
type MilestoneRow = typeof milestones.$inferSelect

export function mapDeliverableRow(row: DeliverableRow): Deliverable {
  return {
    id: toDeliverableId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    projectId: toProjectId(row.projectId),
    parentId: row.parentId ? toDeliverableId(row.parentId) : null,
    title: row.title,
    position: row.position,
    createdBy: toUserId(row.createdBy),
    createdAt: row.createdAt,
  }
}

export function mapMilestoneRow(row: MilestoneRow): Milestone {
  return {
    id: toMilestoneId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    projectId: toProjectId(row.projectId),
    title: row.title,
    dueOn: parseDateOnly(row.dueOn),
    deliverableId: row.deliverableId ? toDeliverableId(row.deliverableId) : null,
    criterion: row.criterion ?? null,
    createdBy: toUserId(row.createdBy),
    createdAt: row.createdAt,
  }
}
