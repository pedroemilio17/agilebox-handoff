import {
  arrangeAfterMove,
  buildWbs,
  canEditProjectStructure,
  canSeeProject,
  canSeeTaskTotal,
  ConflictError,
  createDeliverable,
  formatTaskKey,
  NotFoundError,
  PermissionDeniedError,
  renameDeliverable,
  toDeliverableId,
  toProjectId,
} from '@agilebox/core'
import type {
  Actor,
  DeliverableId,
  Milestone,
  Project,
  ProjectId,
  Task,
  UserId,
  WbsRow,
} from '@agilebox/core'
import type { WbsRowDto, WbsViewDto } from '@agilebox/contract'
import { toMilestoneDto } from '../../mappers'
import { projectCostEnabled } from '../../module-guard'
import type { AppDeps } from '../../deps'
import { findTaskPrefix } from '../tasks/task-prefix'
import { recordGuideEvent } from '../guide/record-guide-event'
import { deliverableOf, linkedDeliverable, structureProject } from './wbs-scope'

const VIEW_DENIED = 'Sem acesso a este projeto'
const PARENT_OTHER_PROJECT = 'A entrega pai é de outro projeto'

/** Chamadas que mudam a EAP publicam a mudança do projeto, como as de definição de pronto. */
async function publishProject(deps: AppDeps, actor: Actor, projectId: ProjectId): Promise<void> {
  await deps.changeNotifier.publish(actor.organizationId, { kind: 'project', ids: [projectId] })
}

/** Centavos viram reais. Quem não é gestor não recebe valor agregado (nulo). */
function money(cents: number, visible: boolean): number | null {
  return visible ? cents / 100 : null
}

/**
 * Leitura da EAP (ADR-10): entregas e tarefas em ordem de exibição, totais por entrega somando as
 * subentregas, e o resumo do projeto. Horas aparecem a quem vê o projeto; valores só ao gestor, e
 * nenhum valor com o módulo `cost` desligado no projeto (`costEnabled: false`, valores nulos).
 */
export async function wbsViewOf(
  deps: AppDeps,
  actor: Actor,
  project: Project,
): Promise<WbsViewDto> {
  const organizationId = actor.organizationId
  const [deliverables, tasks, milestones, users, prefix, costEnabled] = await Promise.all([
    deps.deliverables.listByProject(organizationId, project.id),
    deps.tasks.listByProject(organizationId, project.id),
    deps.milestones.listByProject(organizationId, project.id),
    deps.users.list(organizationId),
    findTaskPrefix(deps, organizationId),
    projectCostEnabled(deps, organizationId, project.id),
  ])
  const tree = buildWbs({ deliverables, tasks, milestones })
  const names = new Map<UserId, string>(users.map((user) => [user.id, user.name]))
  // Valor só para o gestor e só com o módulo `cost` ligado no projeto.
  const seesMoney = costEnabled && canSeeTaskTotal(actor, organizationId)

  const rows = tree.rows.map((row): WbsRowDto => toRowDto(row, names, prefix, seesMoney))
  return {
    projectId: project.id,
    canEdit: canEditProjectStructure(actor, project) && project.archivedAt === null,
    deliverables: rows,
    costEnabled,
    summary: {
      deliverables: tree.summary.deliverables,
      tasks: tree.summary.tasks,
      hours: tree.summary.hoursHundredths / 100,
      cost: money(tree.summary.costCents, seesMoney),
      progress: tree.summary.progress,
    },
    milestones: milestones.map(toMilestoneDto),
    tasksWithoutDeliverable: tree.tasksWithoutDeliverable,
  }
}

function toRowDto(
  row: WbsRow,
  names: ReadonlyMap<UserId, string>,
  prefix: string,
  seesMoney: boolean,
): WbsRowDto {
  if (row.kind === 'deliverable') {
    return {
      kind: 'deliverable',
      id: row.deliverable.id,
      parentId: row.deliverable.parentId,
      code: row.code,
      title: row.deliverable.title,
      level: row.level,
      totals: {
        hours: row.totals.hoursHundredths / 100,
        cost: money(row.totals.costCents, seesMoney),
        progress: row.totals.progress,
        tasks: row.totals.tasks,
        milestones: row.totals.milestones.map(milestoneRef),
      },
    }
  }
  return taskRow(row.task, row.deliverableId, names, prefix)
}

function milestoneRef(milestone: Milestone) {
  return { id: milestone.id, title: milestone.title, dueOn: milestone.dueOn }
}

function taskRow(
  task: Task,
  deliverableId: DeliverableId,
  names: ReadonlyMap<UserId, string>,
  prefix: string,
): WbsRowDto {
  const responsible = task.participations.find((item) => item.role === 'responsible')
  const responsibleName =
    responsible?.participant.kind === 'user'
      ? (names.get(responsible.participant.userId) ?? null)
      : null
  return {
    kind: 'task',
    taskId: task.id,
    key: formatTaskKey(prefix, task.number),
    title: task.title,
    status: task.status,
    deliverableId,
    responsibleName,
    estimatedHours:
      task.estimatedHoursHundredths === null ? null : task.estimatedHoursHundredths / 100,
    deadline: task.deadline,
    done: task.status === 'done',
  }
}

/** Lê a EAP do projeto. Quem vê o projeto lê; o detalhe de valor é filtrado na montagem. */
export class GetWbs {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly projectId: string }): Promise<WbsViewDto> {
    const projectId = toProjectId(input.projectId)
    const project = await this.deps.projects.findById(actor.organizationId, projectId)
    if (!project) throw new NotFoundError('Projeto não encontrado')
    const members = await this.deps.projects.listMembers(actor.organizationId, projectId)
    if (
      !canSeeProject(
        actor,
        project,
        members.some((item) => item.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError(VIEW_DENIED)
    return wbsViewOf(this.deps, actor, project)
  }
}

/**
 * Cria entrega no fim dos irmãos (posição = maior posição + 1). A profundidade de três níveis e o
 * pai do mesmo projeto são conferidos no domínio. Evento do guia: "Liste as entregas principais".
 */
export class CreateDeliverable {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: { readonly projectId: string; readonly parentId: string | null; readonly title: string },
  ): Promise<WbsViewDto> {
    const organizationId = actor.organizationId
    const projectId = toProjectId(input.projectId)
    const project = await structureProject(this.deps, actor, projectId)
    const parentId =
      input.parentId === null
        ? null
        : (
            await linkedDeliverable(
              this.deps,
              organizationId,
              projectId,
              toDeliverableId(input.parentId),
              PARENT_OTHER_PROJECT,
            )
          ).id
    const now = await this.deps.clock.now(organizationId)
    await this.deps.unitOfWork.run(organizationId, async (repos) => {
      const existing = await repos.deliverables.listByProject(organizationId, project.id)
      const position = existing
        .filter((item) => item.parentId === parentId)
        .reduce((next, item) => Math.max(next, item.position + 1), 0)
      const created = createDeliverable(
        {
          id: toDeliverableId(await this.deps.idGenerator.generate(organizationId)),
          organizationId,
          projectId: project.id,
          parentId,
          title: input.title,
          position,
          createdBy: actor.userId,
          createdAt: now,
        },
        existing,
      )
      await repos.deliverables.save(organizationId, created)
      await recordGuideEvent(repos, actor, project.id, 'deliverable.created', now)
    })
    await publishProject(this.deps, actor, project.id)
    return wbsViewOf(this.deps, actor, project)
  }
}

/** Renomeia a entrega (título com a mesma regra de criação). */
export class RenameDeliverable {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: { readonly deliverableId: string; readonly title: string },
  ): Promise<WbsViewDto> {
    const organizationId = actor.organizationId
    const deliverable = await deliverableOf(
      this.deps,
      organizationId,
      toDeliverableId(input.deliverableId),
    )
    const project = await structureProject(this.deps, actor, deliverable.projectId)
    const renamed = renameDeliverable(deliverable, input.title)
    await this.deps.unitOfWork.run(organizationId, (repos) =>
      repos.deliverables.save(organizationId, renamed),
    )
    await publishProject(this.deps, actor, project.id)
    return wbsViewOf(this.deps, actor, project)
  }
}

/**
 * Move a entrega (outro pai e/ou outra posição). Os irmãos afetados são reencaixados no mesmo
 * passo, sem buracos, e gravados em lote dentro da transação.
 */
export class MoveDeliverable {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: {
      readonly deliverableId: string
      readonly parentId: string | null
      readonly position: number
    },
  ): Promise<WbsViewDto> {
    const organizationId = actor.organizationId
    const deliverable = await deliverableOf(
      this.deps,
      organizationId,
      toDeliverableId(input.deliverableId),
    )
    const project = await structureProject(this.deps, actor, deliverable.projectId)
    const parentId =
      input.parentId === null
        ? null
        : (
            await linkedDeliverable(
              this.deps,
              organizationId,
              project.id,
              toDeliverableId(input.parentId),
              PARENT_OTHER_PROJECT,
            )
          ).id
    await this.deps.unitOfWork.run(organizationId, async (repos) => {
      const existing = await repos.deliverables.listByProject(organizationId, project.id)
      const changed = arrangeAfterMove(existing, deliverable.id, {
        parentId,
        position: input.position,
      })
      if (changed.length > 0) await repos.deliverables.saveMany(organizationId, changed)
    })
    await publishProject(this.deps, actor, project.id)
    return wbsViewOf(this.deps, actor, project)
  }
}

/**
 * Remove a entrega. Recusa com mensagem clara quando ainda há subentregas, tarefas ou marcos ligados
 * (o repositório também recusa, como última linha de defesa). Nada é apagado nesse caso.
 */
export class RemoveDeliverable {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly deliverableId: string }): Promise<WbsViewDto> {
    const organizationId = actor.organizationId
    const deliverableId = toDeliverableId(input.deliverableId)
    const deliverable = await deliverableOf(this.deps, organizationId, deliverableId)
    const project = await structureProject(this.deps, actor, deliverable.projectId)
    await this.deps.unitOfWork.run(organizationId, async (repos) => {
      if ((await repos.deliverables.countChildren(organizationId, deliverableId)) > 0)
        throw new ConflictError('Esta entrega tem subentregas. Mova ou remova-as antes.')
      if ((await repos.deliverables.countTasks(organizationId, deliverableId)) > 0)
        throw new ConflictError('Há tarefas ligadas a esta entrega. Desligue-as antes de remover.')
      if ((await repos.deliverables.countMilestones(organizationId, deliverableId)) > 0)
        throw new ConflictError('Há marcos ligados a esta entrega. Desligue-os antes de remover.')
      await repos.deliverables.delete(organizationId, deliverableId)
    })
    await publishProject(this.deps, actor, project.id)
    return wbsViewOf(this.deps, actor, project)
  }
}
