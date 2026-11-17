import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { ProjectModuleChange, ProjectModulesRepository } from '@agilebox/application'
import {
  MODULE_IDS,
  toModuleId,
  toModuleState,
  toTeamModuleConfig,
  ValidationError,
} from '@agilebox/core'
import type { ModuleId, OrganizationId, ProjectId, TeamModuleConfig, UserId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapProjectModuleRow } from '../mappers/project-modules-mappers.js'
import { projectModules, projects, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

const SAVEPOINT = 'project_modules_save'

/** `null` (apagar) e `undefined` (preservar) passam como estão; objeto é validado como configuração. */
function parseConfigChange(
  config: TeamModuleConfig | null | undefined,
): TeamModuleConfig | null | undefined {
  return config === undefined || config === null ? config : toTeamModuleConfig(config)
}

/**
 * Módulos do projeto em SQLite. Toda consulta filtra por `organization_id`. A gravação valida o
 * pedido inteiro antes de escrever e roda dentro de um SAVEPOINT: se uma escrita falhar, nada do
 * pedido fica gravado, com ou sem transação externa (o `SqliteUnitOfWork` abre a sua com BEGIN).
 */
export function createSqliteProjectModulesRepository(
  database: SqliteDatabase,
): ProjectModulesRepository {
  return {
    async list(organizationId: OrganizationId, projectId: ProjectId) {
      const rows = await database
        .select()
        .from(projectModules)
        .where(
          and(
            eq(projectModules.organizationId, organizationId),
            eq(projectModules.projectId, projectId),
          ),
        )
      return rows
        .map(mapProjectModuleRow)
        .sort((a, b) => MODULE_IDS.indexOf(a.moduleId) - MODULE_IDS.indexOf(b.moduleId))
    },

    async save(
      organizationId: OrganizationId,
      projectId: ProjectId,
      changes: readonly ProjectModuleChange[],
      actorId: UserId,
      at: string,
    ) {
      // Só grava com ator e projeto desta organização: a auditoria não pode citar pessoa ou
      // projeto de outro time.
      const [actor] = await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, actorId), eq(users.organizationId, organizationId)))
        .limit(1)
      if (!actor) throw new ValidationError('Ator de outra organização')

      const [project] = await database
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .limit(1)
      if (!project) throw new ValidationError('Projeto não encontrado nesta organização')

      // Valida o pedido inteiro antes da primeira escrita.
      const seen = new Set<ModuleId>()
      const parsed = changes.map((change) => {
        const moduleId = toModuleId(change.moduleId)
        if (seen.has(moduleId)) throw new ValidationError('Módulo repetido no mesmo pedido')
        seen.add(moduleId)
        return {
          moduleId,
          state: toModuleState(change.state),
          config: parseConfigChange(change.config),
        }
      })

      const client = database.$client
      client.exec(`SAVEPOINT ${SAVEPOINT}`)
      try {
        for (const change of parsed) {
          // undefined: preserva a coluna; null: apaga; objeto: grava o JSON.
          const config =
            change.config === undefined
              ? undefined
              : change.config === null
                ? null
                : JSON.stringify(change.config)
          await database
            .insert(projectModules)
            .values({
              organizationId,
              projectId,
              moduleId: change.moduleId,
              state: change.state,
              config: config ?? null,
              changedBy: actorId,
              changedAt: at,
            })
            .onConflictDoUpdate({
              target: [projectModules.projectId, projectModules.moduleId],
              set: {
                state: change.state,
                changedBy: actorId,
                changedAt: at,
                ...(config !== undefined ? { config } : {}),
              },
            })
        }
        client.exec(`RELEASE ${SAVEPOINT}`)
      } catch (error) {
        client.exec(`ROLLBACK TO ${SAVEPOINT}`)
        client.exec(`RELEASE ${SAVEPOINT}`)
        throw error
      }
    },

    async statesAcrossProjects(organizationId: OrganizationId, moduleId: ModuleId) {
      const live = await database
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), isNull(projects.archivedAt)))
      if (live.length === 0) return []

      const rows = await database
        .select({ projectId: projectModules.projectId, state: projectModules.state })
        .from(projectModules)
        .where(
          and(
            eq(projectModules.organizationId, organizationId),
            eq(projectModules.moduleId, moduleId),
            inArray(
              projectModules.projectId,
              live.map((project) => project.id),
            ),
          ),
        )
      return live.map((project) => {
        const row = rows.find((item) => item.projectId === project.id)
        return row === undefined ? 'disabled' : toModuleState(row.state)
      })
    },
  }
}
