import {
  createContributor,
  createOrganization,
  createProject,
  createUser,
  toContributorId,
  toOrganizationId,
  toProjectId,
  toUserId,
} from '@agilebox/core'
import type { Contributor, Organization, Project, User } from '@agilebox/core'
import type { contributors, organizations, projects, users } from '../schema/index.js'

type OrganizationRow = typeof organizations.$inferSelect
type UserRow = typeof users.$inferSelect
type ContributorRow = typeof contributors.$inferSelect
type ProjectRow = typeof projects.$inferSelect

export function mapOrganizationRow(row: OrganizationRow): Organization {
  return createOrganization({
    id: toOrganizationId(row.id),
    name: row.name,
    taskPrefix: row.taskPrefix,
    createdAt: row.createdAt,
  })
}

export function mapUserRow(row: UserRow): User {
  return createUser({
    id: toUserId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    name: row.name,
    email: row.email,
    role: row.role,
    defaultRateCents: row.defaultRateCents,
    createdAt: row.createdAt,
  })
}

export function mapContributorRow(row: ContributorRow): Contributor {
  return createContributor({
    id: toContributorId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    name: row.name,
    source: row.source,
    ...(row.externalId === null ? {} : { externalId: row.externalId }),
    defaultRateCents: row.defaultRateCents,
    createdBy: toUserId(row.createdBy),
    createdAt: row.createdAt,
  })
}

export function mapProjectRow(row: ProjectRow): Project {
  return createProject({
    id: toProjectId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    name: row.name,
    createdBy: toUserId(row.createdBy),
    createdAt: row.createdAt,
  })
}
