import { and, desc, eq } from 'drizzle-orm'
import type { TeamToolsRepository } from '@agilebox/application'
import {
  applyTeamToolsUpdate,
  auditRecordsFor,
  createTeamToolsSettings,
  defaultTeamTools,
  toExperienceLevel,
  ValidationError,
} from '@agilebox/core'
import type { OrganizationId, TeamToolsSettings, UserId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapTeamModuleRow, mapTeamToolsAuditRow } from '../mappers/team-tools-mappers.js'
import { teamModules, teamPreferences, teamToolsAudit, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

const SAVEPOINT = 'team_tools_save'

/**
 * Ajustes da equipe em SQLite. A regra (validação, autoria e auditoria) fica em
 * `applyTeamToolsUpdate` no core; aqui só se lê, se grava e se acrescenta auditoria.
 *
 * A gravação roda dentro de um SAVEPOINT: se qualquer escrita falhar, nada do pedido fica gravado,
 * com ou sem transação externa (o `SqliteUnitOfWork` abre a sua com BEGIN).
 */
export function createSqliteTeamToolsRepository(database: SqliteDatabase): TeamToolsRepository {
  async function readSettings(organizationId: OrganizationId): Promise<TeamToolsSettings> {
    const [preference] = await database
      .select()
      .from(teamPreferences)
      .where(eq(teamPreferences.organizationId, organizationId))
      .limit(1)
    if (!preference) return defaultTeamTools(organizationId)

    const rows = await database
      .select()
      .from(teamModules)
      .where(eq(teamModules.organizationId, organizationId))
    return createTeamToolsSettings({
      level: toExperienceLevel(preference.experienceLevel),
      modules: rows.map(mapTeamModuleRow),
    })
  }

  return {
    async getSettings(organizationId) {
      return readSettings(organizationId)
    },

    async saveSettings(organizationId, update, actorId: UserId, at) {
      // Só grava com ator desta organização: a auditoria não pode citar pessoa de outro time.
      const [actor] = await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, actorId), eq(users.organizationId, organizationId)))
        .limit(1)
      if (!actor) throw new ValidationError('Ator de outra organização')

      const { settings, changes } = applyTeamToolsUpdate(
        await readSettings(organizationId),
        update,
        { organizationId, actorId, at },
      )
      const levelChanged = changes.some((change) => change.kind === 'level')
      const audit = auditRecordsFor(changes, { organizationId, actorId, at })

      const client = database.$client
      client.exec(`SAVEPOINT ${SAVEPOINT}`)
      try {
        await database
          .insert(teamPreferences)
          .values({
            organizationId,
            experienceLevel: settings.level,
            changedBy: levelChanged ? actorId : null,
            changedAt: levelChanged ? at : null,
          })
          .onConflictDoUpdate({
            target: teamPreferences.organizationId,
            set: levelChanged
              ? { experienceLevel: settings.level, changedBy: actorId, changedAt: at }
              : { experienceLevel: settings.level },
          })

        for (const module of settings.modules) {
          const value = {
            organizationId,
            moduleId: module.moduleId,
            state: module.state,
            config: module.config === undefined ? null : JSON.stringify(module.config),
            changedBy: module.changedBy,
            changedAt: module.changedAt,
          }
          await database
            .insert(teamModules)
            .values(value)
            .onConflictDoUpdate({
              target: [teamModules.organizationId, teamModules.moduleId],
              set: {
                state: value.state,
                config: value.config,
                changedBy: value.changedBy,
                changedAt: value.changedAt,
              },
            })
        }

        if (audit.length > 0) {
          await database.insert(teamToolsAudit).values(
            audit.map((record) => ({
              organizationId: record.organizationId,
              actorId: record.actorId,
              kind: record.kind,
              moduleId: record.moduleId,
              before: record.before,
              after: record.after,
              createdAt: record.createdAt,
            })),
          )
        }
        client.exec(`RELEASE ${SAVEPOINT}`)
      } catch (error) {
        client.exec(`ROLLBACK TO ${SAVEPOINT}`)
        client.exec(`RELEASE ${SAVEPOINT}`)
        throw error
      }
    },

    async listAudit(organizationId, limit) {
      if (!Number.isInteger(limit) || limit < 1)
        throw new ValidationError('Limite de auditoria inválido')
      const rows = await database
        .select()
        .from(teamToolsAudit)
        .where(eq(teamToolsAudit.organizationId, organizationId))
        .orderBy(desc(teamToolsAudit.createdAt), desc(teamToolsAudit.id))
        .limit(limit)
      return rows.map(mapTeamToolsAuditRow)
    },
  }
}
