import {
  parseRiskStatus,
  toDeliverableId,
  toOrganizationId,
  toProjectId,
  toRiskId,
  toUserId,
} from '@agilebox/core'
import type { Risk } from '@agilebox/core'
import type { risks } from '../schema/index.js'

type RiskRow = typeof risks.$inferSelect

export function mapRiskRow(row: RiskRow): Risk {
  return {
    id: toRiskId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    projectId: toProjectId(row.projectId),
    title: row.title,
    description: row.description ?? null,
    probability: row.probability as Risk['probability'],
    impact: row.impact as Risk['impact'],
    response: row.response ?? null,
    ownerId: row.ownerId ? toUserId(row.ownerId) : null,
    deliverableId: row.deliverableId ? toDeliverableId(row.deliverableId) : null,
    status: parseRiskStatus(row.status),
    createdBy: toUserId(row.createdBy),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
