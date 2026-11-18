import { and, asc, eq } from 'drizzle-orm'
import { ValidationError } from '@agilebox/core'
import type { DeliverableId, OrganizationId, ProjectId, Risk, RiskId, UserId } from '@agilebox/core'
import type { RiskRepository } from '@agilebox/application'
import { createSqliteClient } from '../client.js'
import { mapRiskRow } from '../mappers/risk-mappers.js'
import { deliverables, projects, risks, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

/**
 * Riscos do projeto (ADR-10). Toda consulta filtra pela organização. Projeto, criador, dono e entrega
 * de outra organização (ou entrega de outro projeto) são recusados com VALIDAÇÃO; id de outra
 * organização não é regravado.
 */
export function createSqliteRiskRepository(database: SqliteDatabase): RiskRepository {
  async function assertOwnersInOrganization(
    organizationId: OrganizationId,
    projectId: ProjectId,
    createdBy: UserId,
  ) {
    const [project] = await database
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
      .limit(1)
    if (!project) throw new ValidationError('Projeto não encontrado nesta organização')
    const [creator] = await database
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, createdBy), eq(users.organizationId, organizationId)))
      .limit(1)
    if (!creator) throw new ValidationError('Pessoa de outra organização')
  }

  async function assertLinks(organizationId: OrganizationId, value: Risk): Promise<void> {
    if (value.ownerId !== null) {
      const [owner] = await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, value.ownerId), eq(users.organizationId, organizationId)))
        .limit(1)
      if (!owner) throw new ValidationError('Dono do risco de outra organização')
    }
    if (value.deliverableId !== null) {
      await assertDeliverableInProject(organizationId, value.projectId, value.deliverableId)
    }
  }

  async function assertDeliverableInProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
    deliverableId: DeliverableId,
  ) {
    const [row] = await database
      .select({ id: deliverables.id })
      .from(deliverables)
      .where(
        and(
          eq(deliverables.id, deliverableId),
          eq(deliverables.organizationId, organizationId),
          eq(deliverables.projectId, projectId),
        ),
      )
      .limit(1)
    if (!row) throw new ValidationError('Entrega não encontrada neste projeto')
  }

  return {
    async listByProject(organizationId, projectId) {
      const rows = await database
        .select()
        .from(risks)
        .where(and(eq(risks.organizationId, organizationId), eq(risks.projectId, projectId)))
        .orderBy(asc(risks.createdAt), asc(risks.id))
      return rows.map(mapRiskRow)
    },
    async findById(organizationId, riskId) {
      const [row] = await database
        .select()
        .from(risks)
        .where(and(eq(risks.organizationId, organizationId), eq(risks.id, riskId)))
        .limit(1)
      return row ? mapRiskRow(row) : null
    },
    async save(organizationId, value: Risk) {
      const [owner] = await database
        .select({ organizationId: risks.organizationId })
        .from(risks)
        .where(eq(risks.id, value.id))
        .limit(1)
      if (owner && owner.organizationId !== organizationId) return
      await assertOwnersInOrganization(organizationId, value.projectId, value.createdBy)
      await assertLinks(organizationId, value)
      const row = {
        organizationId,
        id: value.id,
        projectId: value.projectId,
        title: value.title,
        description: value.description,
        probability: value.probability,
        impact: value.impact,
        response: value.response,
        ownerId: value.ownerId,
        deliverableId: value.deliverableId,
        status: value.status,
        createdBy: value.createdBy,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
      }
      await database
        .insert(risks)
        .values(row)
        .onConflictDoUpdate({
          target: risks.id,
          set: row,
          setWhere: eq(risks.organizationId, organizationId),
        })
    },
    async delete(organizationId, riskId: RiskId) {
      await database
        .delete(risks)
        .where(and(eq(risks.organizationId, organizationId), eq(risks.id, riskId)))
    },
  }
}
