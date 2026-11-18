import { and, asc, count, eq } from 'drizzle-orm'
import { ConflictError, ValidationError } from '@agilebox/core'
import type {
  Deliverable,
  DeliverableId,
  Milestone,
  OrganizationId,
  ProjectId,
  UserId,
} from '@agilebox/core'
import type { DeliverableRepository, MilestoneRepository } from '@agilebox/application'
import { createSqliteClient } from '../client.js'
import { mapDeliverableRow, mapMilestoneRow } from '../mappers/deliverable-mappers.js'
import { deliverables, milestones, projects, tasks, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

/**
 * Entregas da EAP e marcos (ADR-10). Toda consulta filtra pela organização. Pai, projeto e criador
 * de outra organização são recusados com VALIDAÇÃO; id de outra organização não é regravado.
 */
export function createSqliteDeliverableRepositories(database: SqliteDatabase): {
  readonly deliverables: DeliverableRepository
  readonly milestones: MilestoneRepository
} {
  async function assertProjectAndCreator(
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

  /** Entrega ligada precisa existir na organização e no mesmo projeto. */
  async function assertDeliverableInProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
    deliverableId: DeliverableId,
    message: string,
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
    if (!row) throw new ValidationError(message)
  }

  const deliverableRepository: DeliverableRepository = {
    async listByProject(organizationId, projectId) {
      const rows = await database
        .select()
        .from(deliverables)
        .where(
          and(
            eq(deliverables.organizationId, organizationId),
            eq(deliverables.projectId, projectId),
          ),
        )
        .orderBy(asc(deliverables.parentId), asc(deliverables.position), asc(deliverables.id))
      return rows.map(mapDeliverableRow)
    },
    async findById(organizationId, deliverableId) {
      const [row] = await database
        .select()
        .from(deliverables)
        .where(
          and(eq(deliverables.organizationId, organizationId), eq(deliverables.id, deliverableId)),
        )
        .limit(1)
      return row ? mapDeliverableRow(row) : null
    },
    async save(organizationId, value: Deliverable) {
      const [owner] = await database
        .select({ organizationId: deliverables.organizationId })
        .from(deliverables)
        .where(eq(deliverables.id, value.id))
        .limit(1)
      if (owner && owner.organizationId !== organizationId) return
      await assertProjectAndCreator(organizationId, value.projectId, value.createdBy)
      if (value.parentId !== null)
        await assertDeliverableInProject(
          organizationId,
          value.projectId,
          value.parentId,
          'Entrega pai não encontrada neste projeto',
        )
      const row = {
        organizationId,
        id: value.id,
        projectId: value.projectId,
        parentId: value.parentId,
        title: value.title,
        position: value.position,
        createdBy: value.createdBy,
        createdAt: value.createdAt,
      }
      await database
        .insert(deliverables)
        .values(row)
        .onConflictDoUpdate({
          target: deliverables.id,
          set: row,
          setWhere: eq(deliverables.organizationId, organizationId),
        })
    },
    async saveMany(organizationId, values) {
      // Chamado dentro da transação do UnitOfWork: ou todas as posições mudam, ou nenhuma.
      for (const value of values) await deliverableRepository.save(organizationId, value)
    },
    async countChildren(organizationId, deliverableId) {
      const [row] = await database
        .select({ total: count() })
        .from(deliverables)
        .where(
          and(
            eq(deliverables.organizationId, organizationId),
            eq(deliverables.parentId, deliverableId),
          ),
        )
      return Number(row?.total ?? 0)
    },
    async countTasks(organizationId, deliverableId) {
      const [row] = await database
        .select({ total: count() })
        .from(tasks)
        .where(
          and(eq(tasks.organizationId, organizationId), eq(tasks.deliverableId, deliverableId)),
        )
      return Number(row?.total ?? 0)
    },
    async countMilestones(organizationId, deliverableId) {
      const [row] = await database
        .select({ total: count() })
        .from(milestones)
        .where(
          and(
            eq(milestones.organizationId, organizationId),
            eq(milestones.deliverableId, deliverableId),
          ),
        )
      return Number(row?.total ?? 0)
    },
    async delete(organizationId, deliverableId) {
      const children = await deliverableRepository.countChildren(organizationId, deliverableId)
      const linkedTasks = await deliverableRepository.countTasks(organizationId, deliverableId)
      const linkedMilestones = await deliverableRepository.countMilestones(
        organizationId,
        deliverableId,
      )
      if (children + linkedTasks + linkedMilestones > 0)
        throw new ConflictError(
          'Entrega tem filhos, tarefas ou marcos ligados e não pode ser apagada',
        )
      await database
        .delete(deliverables)
        .where(
          and(eq(deliverables.organizationId, organizationId), eq(deliverables.id, deliverableId)),
        )
    },
  }

  const milestoneRepository: MilestoneRepository = {
    async listByProject(organizationId, projectId) {
      const rows = await database
        .select()
        .from(milestones)
        .where(
          and(eq(milestones.organizationId, organizationId), eq(milestones.projectId, projectId)),
        )
        .orderBy(asc(milestones.dueOn), asc(milestones.title), asc(milestones.id))
      return rows.map(mapMilestoneRow)
    },
    async findById(organizationId, milestoneId) {
      const [row] = await database
        .select()
        .from(milestones)
        .where(and(eq(milestones.organizationId, organizationId), eq(milestones.id, milestoneId)))
        .limit(1)
      return row ? mapMilestoneRow(row) : null
    },
    async save(organizationId, value: Milestone) {
      const [owner] = await database
        .select({ organizationId: milestones.organizationId })
        .from(milestones)
        .where(eq(milestones.id, value.id))
        .limit(1)
      if (owner && owner.organizationId !== organizationId) return
      await assertProjectAndCreator(organizationId, value.projectId, value.createdBy)
      if (value.deliverableId !== null)
        await assertDeliverableInProject(
          organizationId,
          value.projectId,
          value.deliverableId,
          'Entrega não encontrada neste projeto',
        )
      const row = {
        organizationId,
        id: value.id,
        projectId: value.projectId,
        title: value.title,
        dueOn: value.dueOn,
        deliverableId: value.deliverableId,
        criterion: value.criterion,
        createdBy: value.createdBy,
        createdAt: value.createdAt,
      }
      await database
        .insert(milestones)
        .values(row)
        .onConflictDoUpdate({
          target: milestones.id,
          set: row,
          setWhere: eq(milestones.organizationId, organizationId),
        })
    },
    async delete(organizationId, milestoneId) {
      await database
        .delete(milestones)
        .where(and(eq(milestones.organizationId, organizationId), eq(milestones.id, milestoneId)))
    },
  }

  return { deliverables: deliverableRepository, milestones: milestoneRepository }
}
