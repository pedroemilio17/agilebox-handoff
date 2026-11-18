import {
  canSeeProject,
  FLOW_TREND_WEEKS,
  flowMetrics,
  flowSeries,
  flowWeeks,
  NotFoundError,
  PermissionDeniedError,
  toDateOnly,
  toProjectId,
} from '@agilebox/core'
import type { Actor, TimelineEvent } from '@agilebox/core'
import type { FlowMetricsViewDto } from '@agilebox/contract'
import type { AppDeps } from '../../deps'
import { visibleTasks } from '../tasks/task-visibility'

const VIEW_DENIED = 'Sem acesso a este projeto'

/**
 * Métricas de fluxo do projeto (ADR-10, módulo `flowMetrics`): lead time, cycle time e vazão das
 * últimas oito semanas, calculados da linha do tempo. Quem vê o projeto lê; sem valores de custo.
 * Usa as mesmas regras do dashboard (`core/rules/flow.ts`) e a mesma visibilidade de tarefas: arquivadas
 * e de backlog ficam de fora.
 */
export class GetFlowMetrics {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly projectId: string }): Promise<FlowMetricsViewDto> {
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
    const weeks = flowWeeks(today, timeZone, FLOW_TREND_WEEKS)
    const first = weeks[0]!
    const last = weeks[weeks.length - 1]!

    const tasks = await visibleTasks(
      this.deps,
      organizationId,
      await this.deps.tasks.listByProject(organizationId, projectId),
    )
    const events: TimelineEvent[] = (
      await Promise.all(tasks.map((task) => this.deps.timeline.listByTask(organizationId, task.id)))
    ).flat()

    const window = { start: first.start, endExclusive: last.endExclusive, timeZone }
    const overall = flowMetrics(tasks, events, window, now)
    const series = flowSeries(tasks, events, weeks, now)

    return {
      projectId,
      today,
      windowStart: first.start,
      windowEnd: last.endExclusive,
      leadDays: overall.leadDays,
      cycleDays: overall.cycleDays,
      completed: overall.throughput,
      weeks: series.map((week) => ({ start: week.start, completed: week.throughput })),
    }
  }
}
