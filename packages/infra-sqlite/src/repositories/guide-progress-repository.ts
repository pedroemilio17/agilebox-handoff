import { and, eq } from 'drizzle-orm'
import { GUIDE_CARD_KEY, GUIDE_WELCOME_KEY, isReservedGuideKey } from '@agilebox/application'
import type { GuideProgressRepository } from '@agilebox/application'
import { ValidationError } from '@agilebox/core'
import type { OrganizationId, ProjectId, UserId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapGuideProgressRow } from '../mappers/guide-progress-mappers.js'
import { guideProgress, projects, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

/**
 * Progresso do guia em SQLite. Toda consulta filtra por `organization_id`. Projeto e pessoa são
 * conferidos na organização antes de gravar (a chave estrangeira sozinha não impede outra
 * organização). A regravação de passo concluído não muda o `done_at` nem a dispensa.
 */
export function createSqliteGuideProgressRepository(
  database: SqliteDatabase,
): GuideProgressRepository {
  /** Projeto e pessoa precisam existir nesta organização; senão nada é gravado. */
  async function assertOwnership(
    organizationId: OrganizationId,
    projectId: ProjectId,
    userId: UserId,
  ): Promise<void> {
    const [project] = await database
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
      .limit(1)
    if (!project) throw new ValidationError('Projeto não encontrado nesta organização')
    const [person] = await database
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)))
      .limit(1)
    if (!person) throw new ValidationError('Pessoa de outra organização')
  }

  /** Upsert de uma chave reservada com `dismissed = 1` e sem `done_at`. Não toca em passos. */
  async function dismissReserved(
    organizationId: OrganizationId,
    projectId: ProjectId,
    userId: UserId,
    stepKey: string,
    at: string,
  ): Promise<void> {
    await assertOwnership(organizationId, projectId, userId)
    // O schema não guarda o instante da dispensa nem da resposta; `at` fica na assinatura da porta.
    void at
    await database
      .insert(guideProgress)
      .values({ organizationId, projectId, userId, stepKey, doneAt: null, dismissed: true })
      .onConflictDoUpdate({
        target: [guideProgress.projectId, guideProgress.userId, guideProgress.stepKey],
        set: { dismissed: true },
      })
  }

  return {
    async listForUser(organizationId: OrganizationId, projectId: ProjectId, userId: UserId) {
      const rows = await database
        .select()
        .from(guideProgress)
        .where(
          and(
            eq(guideProgress.organizationId, organizationId),
            eq(guideProgress.projectId, projectId),
            eq(guideProgress.userId, userId),
          ),
        )
      return rows.map(mapGuideProgressRow)
    },

    async markDone(
      organizationId: OrganizationId,
      projectId: ProjectId,
      userId: UserId,
      stepKeys: readonly string[],
      at: string,
    ) {
      await assertOwnership(organizationId, projectId, userId)
      if (stepKeys.some(isReservedGuideKey))
        throw new ValidationError('Chave reservada do guia não é um passo')
      if (stepKeys.length === 0) return

      // Um único INSERT: ou todos os passos entram, ou nenhum. Passo já gravado fica como está.
      const values = [...new Set(stepKeys)].map((stepKey) => ({
        organizationId,
        projectId,
        userId,
        stepKey,
        doneAt: at,
        dismissed: false,
      }))
      await database.insert(guideProgress).values(values).onConflictDoNothing()
    },

    async dismissCard(
      organizationId: OrganizationId,
      projectId: ProjectId,
      userId: UserId,
      at: string,
    ) {
      await dismissReserved(organizationId, projectId, userId, GUIDE_CARD_KEY, at)
    },

    async resolveWelcome(
      organizationId: OrganizationId,
      projectId: ProjectId,
      userId: UserId,
      at: string,
    ) {
      await dismissReserved(organizationId, projectId, userId, GUIDE_WELCOME_KEY, at)
    },
  }
}
