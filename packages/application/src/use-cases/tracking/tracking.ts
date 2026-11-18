import {
  canSeeProject,
  canSeeTaskTotal,
  compareDateOnly,
  daysUntilDate,
  deliverableSubtree,
  milestoneStatus,
  moduleStateOf,
  nextMilestone,
  NotFoundError,
  PermissionDeniedError,
  toDateOnly,
  toProjectId,
  trackingTotals,
  weekOf,
} from '@agilebox/core'
import type {
  Actor,
  Deliverable,
  DeliverableId,
  Milestone,
  Task,
  TaskDependency,
  UserId,
} from '@agilebox/core'
import type {
  TrackingMilestoneDto,
  TrackingNextMilestoneDto,
  TrackingViewDto,
} from '@agilebox/contract'
import type { AppDeps } from '../../deps'
import { rangeOf } from '../schedule/schedule-view'

const VIEW_DENIED = 'Sem acesso a este projeto'

/** Centavos viram reais. Quem não é gestor, ou com o módulo `cost` desligado, não recebe valor (nulo). */
function money(cents: number, visible: boolean): number | null {
  return visible ? cents / 100 : null
}

/** Tarefas ativas da entrega ligada ao marco e das subentregas. Nulo quando o marco não tem entrega. */
function scopeOf(
  milestone: Milestone,
  deliverables: readonly Deliverable[],
  tasks: readonly Task[],
): Task[] | null {
  if (milestone.deliverableId === null) return null
  const ids: ReadonlySet<DeliverableId> = deliverableSubtree(milestone.deliverableId, deliverables)
  return tasks.filter((task) => task.deliverableId !== null && ids.has(task.deliverableId))
}

/**
 * Acompanhamento do projeto tradicional (ADR-10, módulo `schedule`). Quem vê o projeto lê. Tarefa
 * arquivada fica de fora de tudo. Os marcos só aparecem com o módulo `milestones` não desligado, e a
 * entrega do marco só com o módulo `wbs`. Valores (custo) só para o gestor e só com o módulo `cost`
 * ligado no projeto (`costEnabled`); desligado, os valores vêm nulos e o cartão some na tela.
 */
export class GetTracking {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly projectId: string }): Promise<TrackingViewDto> {
    const organizationId = actor.organizationId
    const projectId = toProjectId(input.projectId)
    const project = await this.deps.projects.findById(organizationId, projectId)
    if (!project) throw new NotFoundError('Projeto não encontrado')
    const members = await this.deps.projects.listMembers(organizationId, projectId)
    if (
      !canSeeProject(
        actor,
        project,
        members.some((item) => item.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError(VIEW_DENIED)

    const now = await this.deps.clock.now(organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const today = toDateOnly(new Date(now), timeZone)
    const [allTasks, deliverables, dependencies, modules, users, milestones] = await Promise.all([
      this.deps.tasks.listByProject(organizationId, projectId),
      this.deps.deliverables.listByProject(organizationId, projectId),
      this.deps.taskDependencies.listByProject(organizationId, projectId),
      this.deps.projectModules.list(organizationId, projectId),
      this.deps.users.list(organizationId),
      this.deps.milestones.listByProject(organizationId, projectId),
    ])
    // Marcos e entrega seguem a mesma regra de leitura de `milestones.list` (só o desligado some).
    const milestonesOn = moduleStateOf(modules, 'milestones') !== 'disabled'
    const wbsOn = moduleStateOf(modules, 'wbs') !== 'disabled'
    const tasks = allTasks.filter((task) => task.archivedAt === null)
    const costEnabled = moduleStateOf(modules, 'cost') !== 'disabled'
    const seesMoney = costEnabled && canSeeTaskTotal(actor, organizationId)

    const rates = new Map<UserId, number>(users.map((user) => [user.id, user.defaultRateCents]))
    const totals = trackingTotals(tasks, (userId) => rates.get(userId) ?? 0)
    const pairs = dependencies.map((dependency: TaskDependency) => ({
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
    }))
    const deliverableTitles = new Map(deliverables.map((item) => [item.id, item.title]))

    const rows = (milestonesOn ? milestones : []).map((milestone) => {
      const status = milestoneStatus({
        dueOn: milestone.dueOn,
        today,
        scope: scopeOf(milestone, deliverables, tasks),
        dependencies: pairs,
        tasks,
      })
      return {
        id: milestone.id,
        title: milestone.title,
        dueOn: milestone.dueOn,
        criterion: milestone.criterion,
        deliverableTitle:
          wbsOn && milestone.deliverableId !== null
            ? (deliverableTitles.get(milestone.deliverableId) ?? null)
            : null,
        status,
      } satisfies TrackingMilestoneDto
    })
    rows.sort(
      (a, b) => compareDateOnly(a.dueOn, b.dueOn) || a.title.localeCompare(b.title, 'pt-BR'),
    )

    const next = nextMilestone(rows, today)
    const nextView: TrackingNextMilestoneDto | null =
      next === null
        ? null
        : {
            id: next.id,
            title: next.title,
            dueOn: next.dueOn,
            daysLeft: daysUntilDate(next.dueOn, today),
            status: next.status,
          }

    return {
      projectId,
      week: weekOf(rangeOf(tasks), today),
      costEnabled,
      summary: {
        progress: totals.progress,
        plannedHours: totals.plannedHoursHundredths / 100,
        loggedHours: totals.loggedHoursHundredths / 100,
        realizedCost: money(totals.realizedCostCents, seesMoney),
        plannedCost: money(totals.plannedCostCents, seesMoney),
        tasks: totals.tasks,
      },
      nextMilestone: nextView,
      milestones: rows,
      today,
    }
  }
}
