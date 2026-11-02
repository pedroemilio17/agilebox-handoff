import { and, asc, eq, isNull } from 'drizzle-orm'
import { ValidationError } from '@agilebox/core'
import type { OrganizationId, ProjectId, UserId } from '@agilebox/core'
import type {
  ContributorRepository,
  ProjectMember,
  ProjectRepository,
  UserRepository,
} from '@agilebox/application'
import { createSqliteClient } from '../client.js'
import { mapContributorRow, mapProjectRow, mapUserRow } from '../mappers/core-mappers.js'
import { contributors, projectMembers, projects, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

/** Violação do índice `projects_organization_name_key_unique`, mesmo embrulhada pelo Drizzle. */
function isActiveProjectNameConflict(error: unknown): boolean {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    const code = (current as { code?: unknown }).code
    if (code === 'SQLITE_CONSTRAINT_UNIQUE' && current.message.includes('projects.name_key'))
      return true
  }
  return false
}

export function createSqliteCoreRepositories(database: SqliteDatabase): {
  readonly users: UserRepository
  readonly contributors: ContributorRepository
  readonly projects: ProjectRepository
} {
  const userRepository: UserRepository = {
    async findById(organizationId, userId) {
      const [row] = await database
        .select()
        .from(users)
        .where(and(eq(users.organizationId, organizationId), eq(users.id, userId)))
        .limit(1)
      return row ? mapUserRow(row) : null
    },
    async list(organizationId) {
      const rows = await database
        .select()
        .from(users)
        .where(eq(users.organizationId, organizationId))
        .orderBy(asc(users.name))
      return rows.map(mapUserRow)
    },
    async save(organizationId, user) {
      await database
        .insert(users)
        .values({ ...user, organizationId })
        .onConflictDoUpdate({
          target: users.id,
          set: { ...user, organizationId },
          setWhere: eq(users.organizationId, organizationId),
        })
    },
  }

  const contributorRepository: ContributorRepository = {
    async findById(organizationId, contributorId) {
      const [row] = await database
        .select()
        .from(contributors)
        .where(
          and(eq(contributors.organizationId, organizationId), eq(contributors.id, contributorId)),
        )
        .limit(1)
      return row ? mapContributorRow(row) : null
    },
    async list(organizationId) {
      const rows = await database
        .select()
        .from(contributors)
        .where(eq(contributors.organizationId, organizationId))
        .orderBy(asc(contributors.name))
      return rows.map(mapContributorRow)
    },
    async save(organizationId, contributor) {
      const value = { ...contributor, organizationId, externalId: contributor.externalId ?? null }
      await database
        .insert(contributors)
        .values(value)
        .onConflictDoUpdate({
          target: contributors.id,
          set: value,
          setWhere: eq(contributors.organizationId, organizationId),
        })
    },
  }

  const projectRepository: ProjectRepository = {
    async findById(organizationId, projectId) {
      const [row] = await database
        .select()
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
        .limit(1)
      return row ? mapProjectRow(row) : null
    },
    async findByNameKey(organizationId, nameKey) {
      const [row] = await database
        .select()
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), eq(projects.nameKey, nameKey)))
        .limit(1)
      return row ? mapProjectRow(row) : null
    },
    async findActiveByNameKey(organizationId, nameKey) {
      const [row] = await database
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, organizationId),
            eq(projects.nameKey, nameKey),
            isNull(projects.archivedAt),
          ),
        )
        .limit(1)
      return row ? mapProjectRow(row) : null
    },
    async list(organizationId) {
      const rows = await database
        .select()
        .from(projects)
        .where(eq(projects.organizationId, organizationId))
        .orderBy(asc(projects.name))
      return rows.map(mapProjectRow)
    },
    async save(organizationId, project) {
      const value = { ...project, organizationId }
      try {
        await database
          .insert(projects)
          .values(value)
          .onConflictDoUpdate({
            target: projects.id,
            set: value,
            setWhere: eq(projects.organizationId, organizationId),
          })
      } catch (error) {
        // Corrida entre checar e gravar: o índice único de nome ativo vence a checagem da aplicação.
        if (isActiveProjectNameConflict(error))
          throw new ValidationError('Já existe um projeto com este nome')
        throw error
      }
    },
    async listMembers(organizationId, projectId) {
      const rows = await database
        .select({
          projectId: projectMembers.projectId,
          userId: projectMembers.userId,
          addedBy: projectMembers.addedBy,
          addedAt: projectMembers.addedAt,
        })
        .from(projectMembers)
        .innerJoin(projects, eq(projectMembers.projectId, projects.id))
        .where(
          and(eq(projects.organizationId, organizationId), eq(projectMembers.projectId, projectId)),
        )
        .orderBy(asc(projectMembers.addedAt), asc(projectMembers.userId))
      return rows.map((row) => ({
        projectId: row.projectId as ProjectId,
        userId: row.userId as UserId,
        addedBy: row.addedBy as UserId,
        addedAt: row.addedAt,
      }))
    },
    async addMember(organizationId, member: ProjectMember) {
      const [project] = await database
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, member.projectId), eq(projects.organizationId, organizationId)))
        .limit(1)
      if (!project) return
      await database.insert(projectMembers).values(member).onConflictDoNothing()
    },
    async removeMember(organizationId: OrganizationId, projectId: ProjectId, userId: UserId) {
      const [project] = await database
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .limit(1)
      if (!project) return
      await database
        .delete(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    },
  }

  return { users: userRepository, contributors: contributorRepository, projects: projectRepository }
}
