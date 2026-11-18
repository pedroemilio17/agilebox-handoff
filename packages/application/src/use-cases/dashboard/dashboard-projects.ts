import {
  daysUntilDate,
  diffInDays,
  isOverdueTask,
  isStaleTask,
  moduleStateOf,
  overWipColumns,
  parseDateOnly,
  projectHealth,
  TASK_STATUS_LABELS,
} from '@agilebox/core'
import type {
  Actor,
  DateOnly,
  Project,
  ProjectId,
  Task,
  TaskId,
  TimelineEvent,
  WipLimits,
} from '@agilebox/core'
import type { DashboardDto } from '@agilebox/contract'
import type { AppDeps } from '../../deps'
import { GetBaseline } from '../baseline/baseline'
import { GetBurndown } from '../burndown/burndown'
import { GetFlowMetrics } from '../flow-metrics/flow-metrics'
import { GetTracking } from '../tracking/tracking'

type DashboardInsights = NonNullable<DashboardDto['insights']>
export type DashboardProjectCard = DashboardInsights['projects'][number]
export type DashboardNeed = DashboardInsights['needs'][number]
type SprintSummary = NonNullable<Extract<DashboardProjectCard['kpi'], { kind: 'sprint' }>['sprint']>

export interface ProjectCardsContext {
  readonly projects: readonly Project[]
  /** Tarefas visíveis ao gestor (sem arquivadas e sem projeto arquivado). */
  readonly tasks: readonly Task[]
  readonly events: readonly TimelineEvent[]
  readonly today: DateOnly
  readonly timeZone: string
  readonly wipLimits: WipLimits
}

export interface ProjectCardsResult {
  readonly projects: DashboardProjectCard[]
  readonly needs: DashboardNeed[]
  /** Método (preset de partida) de cada projeto, para o rótulo nas listas de atualizações. */
  readonly methodByProject: ReadonlyMap<ProjectId, DashboardProjectCard['method']>
  /** Tarefas concluídas com critério de aceite ainda pendente. */
  readonly pendingAcceptance: ReadonlySet<TaskId>
}

const KIND_ORDER: Record<DashboardNeed['kind'], number> = { wip: 0, milestone: 1, acceptance: 2 }

function sprintSummary(
  sprint: { number: number; plannedStart: string; plannedEnd: string },
  remainingHours: number,
  today: DateOnly,
): SprintSummary {
  const start = parseDateOnly(sprint.plannedStart)
  const totalDays = Math.max(1, diffInDays(start, parseDateOnly(sprint.plannedEnd)) + 1)
  const day = Math.min(totalDays, Math.max(1, diffInDays(start, today) + 1))
  return {
    number: sprint.number,
    day,
    totalDays,
    remainingHours,
    endsOn: sprint.plannedEnd,
  }
}

/**
 * Cartões dos projetos e "Precisa de você". Cada projeto é medido pelos casos de uso que já existem
 * (acompanhamento, burndown, linha de base, fluxo), e só pelos módulos que o projeto tem ligados.
 * O gestor vê todos os projetos, então as leituras não recusam.
 */
export async function buildProjectCards(
  deps: AppDeps,
  actor: Actor,
  context: ProjectCardsContext,
): Promise<ProjectCardsResult> {
  const { today, timeZone } = context
  const organizationId = actor.organizationId
  const projects: DashboardProjectCard[] = []
  const needs: DashboardNeed[] = []
  const methodByProject = new Map<ProjectId, DashboardProjectCard['method']>()
  const pendingAcceptance = new Set<TaskId>()
  const tracking = new GetTracking(deps)
  const burndown = new GetBurndown(deps)
  const baseline = new GetBaseline(deps)
  const flow = new GetFlowMetrics(deps)

  for (const project of context.projects) {
    const modules = await deps.projectModules.list(organizationId, project.id)
    const on = (id: Parameters<typeof moduleStateOf>[1]) =>
      moduleStateOf(modules, id) !== 'disabled'
    const setup = await deps.projectSetup.get(organizationId, project.id)
    const method = setup?.startedFromPreset ?? null
    methodByProject.set(project.id, method)
    const projectTasks = context.tasks.filter((task) => task.projectId === project.id)
    const taskIds = new Set(projectTasks.map((task) => task.id))
    const projectEvents = context.events.filter((event) => taskIds.has(event.taskId))
    const eventsOf = (task: Task) => projectEvents.filter((event) => event.taskId === task.id)

    const view = { projectId: project.id }
    const board = await tracking.execute(actor, view)
    const next = board.nextMilestone
    const burn = on('sprints') ? await burndown.execute(actor, view) : null
    const activeSprint = burn?.sprint?.status === 'active' ? burn.sprint : null
    const base = on('baseline') && on('schedule') ? await baseline.execute(actor, view) : null
    const deviation = base?.summary?.endDeviationDays ?? null
    const flowView = on('flowMetrics') ? await flow.execute(actor, view) : null

    // Sinais de saúde, na ordem em que o motivo aparece.
    const overWip = on('wip') ? overWipColumns(projectTasks, context.wipLimits) : []
    const aging = projectTasks.filter((task) => isStaleTask(task, eventsOf(task), today, timeZone))
    const health = projectHealth({
      overdueCount: projectTasks.filter((task) => isOverdueTask(task, today)).length,
      atRiskMilestones: board.milestones.filter((milestone) => milestone.status === 'at_risk')
        .length,
      overWipColumns: overWip.length,
      agingCount: aging.length,
      blockedCount: projectTasks.filter((task) => task.blockedReason !== null).length,
      endDeviationDays: deviation,
    })

    // Indicador principal: a forma depende da metodologia, com fallback para o progresso.
    const progress = {
      kind: 'progress' as const,
      percent: board.summary.progress,
      done: board.summary.tasks.done,
      total: board.summary.tasks.total,
      week: board.week,
      spentCost: board.summary.realizedCost,
      baselineDeviationDays: deviation,
    }
    const sprintKpi = activeSprint
      ? {
          kind: 'sprint' as const,
          sprint: sprintSummary(activeSprint, burn?.remainingHours ?? 0, today),
        }
      : null
    let kpi: DashboardProjectCard['kpi']
    let trend: DashboardProjectCard['trend'] = null
    if (method === 'kanban' && flowView) {
      kpi = {
        kind: 'flow',
        leadDays: flowView.leadDays,
        completedLastWeek: flowView.weeks[flowView.weeks.length - 1]?.completed ?? 0,
      }
      trend = { reference: null, actual: flowView.weeks.map((week) => week.completed) }
    } else if (method === 'hibrido' && next) {
      kpi = {
        kind: 'milestone',
        title: next.title,
        daysLeft: next.daysLeft,
        percent: board.summary.progress,
        sprint: sprintKpi?.sprint ?? null,
      }
    } else if (sprintKpi && method !== 'tradicional') {
      kpi = sprintKpi
    } else {
      kpi = progress
    }
    if (kpi.kind === 'sprint' && burn && on('burndown')) {
      trend = {
        reference: burn.days.map((day) => day.idealHours),
        actual: burn.days.map((day) => day.remainingHours),
      }
    }

    projects.push({
      id: project.id,
      name: project.name,
      method,
      health: health.health,
      healthReason: health.reason,
      kpi,
      trend,
    })

    if (on('wip'))
      for (const column of overWip)
        needs.push({
          id: `wip:${project.id}:${column.status}`,
          kind: 'wip',
          projectId: project.id,
          projectName: project.name,
          taskId: null,
          text: `${TASK_STATUS_LABELS[column.status]} está com ${column.count} de ${column.limit}.`,
          at: projectEvents
            .filter(
              (event) => event.type === 'status_changed' && event.payload.after === column.status,
            )
            .reduce<string | null>(
              (latest, event) => (latest === null || event.at > latest ? event.at : latest),
              null,
            ),
        })

    if (on('milestones'))
      for (const milestone of board.milestones) {
        if (milestone.status !== 'at_risk') continue
        const days = daysUntilDate(parseDateOnly(milestone.dueOn), today)
        const when =
          days === 0
            ? 'vence hoje'
            : days > 0
              ? `vence em ${days} ${days === 1 ? 'dia' : 'dias'}`
              : `venceu há ${-days} ${days === -1 ? 'dia' : 'dias'}`
        needs.push({
          id: `milestone:${milestone.id}`,
          kind: 'milestone',
          projectId: project.id,
          projectName: project.name,
          taskId: null,
          text: `${milestone.title} está em risco: ${when}.`,
          at: null,
        })
      }

    if (on('acceptance')) {
      const doneTasks = projectTasks.filter((task) => task.status === 'done')
      const criteria = await deps.acceptance.listByTasks(
        organizationId,
        doneTasks.map((task) => task.id),
      )
      for (const task of doneTasks) {
        const pending = criteria
          .filter((criterion) => criterion.taskId === task.id && !criterion.done)
          .sort((a, b) => a.position - b.position)[0]
        if (!pending) continue
        pendingAcceptance.add(task.id)
        const events = eventsOf(task)
        needs.push({
          id: `acceptance:${task.id}`,
          kind: 'acceptance',
          projectId: project.id,
          projectName: project.name,
          taskId: task.id,
          text: `${task.title} foi concluída sem “${pending.text}”.`,
          at: events.reduce<string | null>(
            (latest, event) => (latest === null || event.at > latest ? event.at : latest),
            null,
          ),
        })
      }
    }
  }

  needs.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
  return { projects, needs, methodByProject, pendingAcceptance }
}
