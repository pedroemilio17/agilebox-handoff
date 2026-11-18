import {
  collaboratorStats,
  PermissionDeniedError,
  statusPercentages,
  toDateOnly,
  flowWeeks,
  flowMetrics,
  flowSeries,
  isStaleTask,
  isOverdueTask,
  moduleUseRefusal,
  recentChanges,
  lastActorUpdate,
  participates,
  describeEvent,
  overWipColumns,
} from '@agilebox/core'
import type { Actor, Task, TimelineEvent } from '@agilebox/core'
import type { DashboardDto } from '@agilebox/contract'
import { organizationModuleStateOf } from '../../module-guard'
import { toDashboardDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { visibleTasks } from '../tasks/task-visibility'

type DashboardInsights = NonNullable<DashboardDto['insights']>
type FlowInsights = Pick<
  DashboardInsights,
  'upToDatePercentage' | 'cycleDays' | 'leadDays' | 'throughput' | 'weeks'
>

export class GetDashboard {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<DashboardDto> {
    if (actor.role !== 'manager')
      throw new PermissionDeniedError('Somente o gestor pode acessar o dashboard')

    const [allTasks, users, boardSettings, flowState] = await Promise.all([
      this.deps.tasks.listBoard(actor.organizationId, {}),
      this.deps.users.list(actor.organizationId),
      this.deps.boardSettings.findByOrganization(actor.organizationId),
      organizationModuleStateOf(this.deps, actor.organizationId, 'flowMetrics'),
    ])
    // Dashboard e insights não contam tarefas arquivadas nem as de projeto arquivado.
    const tasks = await visibleTasks(this.deps, actor.organizationId, allTasks)
    const collaborators = users
      .map((user) => ({ user, ...collaboratorStats(tasks, actor.organizationId, user.id) }))
      .filter((stat) => stat.taskCount > 0)

    const now = await this.deps.clock.now(actor.organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const today = toDateOnly(new Date(now), timeZone)
    const weeks = flowWeeks(today, timeZone)
    const events = (
      await Promise.all(
        tasks.map((task) => this.deps.timeline.listByTask(actor.organizationId, task.id)),
      )
    ).flat()
    // Com `flowMetrics` desligado (regra do guard: `active` ou `winding_down` liberam a leitura),
    // os insights de fluxo nem são calculados e somem do DTO (PLANO-2.0, regra 6). Painel da
    // organização: vale o estado do módulo nos projetos ativos (ADR-10).
    const flowEnabled = moduleUseRefusal(flowState, { creates: false }) === null
    const flow = flowEnabled ? this.flowInsights(tasks, events, weeks, now) : {}
    const aging = tasks.filter((task) => isStaleTask(task, events, today, timeZone))
    const overdue = tasks.filter((task) => isOverdueTask(task, today))
    const isBlocked = (task: Task) => task.blockedReason !== null
    const names = new Map(users.map((user) => [user.id, user.name]))
    const taskNames = new Map(tasks.map((task) => [task.id, task.title]))
    const since = new Date(now)
    since.setDate(since.getDate() - 1)
    since.setHours(0, 0, 0, 0)
    const contributors = await this.deps.contributors.list(actor.organizationId)
    const contributorNames = new Map(contributors.map((person) => [person.id, person.name]))
    return {
      ...toDashboardDto(statusPercentages(tasks), collaborators),
      insights: {
        updatedAt: now,
        weekStart: weeks[5]!.start,
        ...flow,
        agingCount: aging.length,
        overdueCount: overdue.length,
        blockedCount: tasks.filter(isBlocked).length,
        // Todas as tarefas da organização, não só as do gestor.
        overWipColumns: overWipColumns(tasks, boardSettings?.wipLimits ?? {}),
        recentChanges: recentChanges(tasks, events, since.toISOString(), now).map((event) => ({
          id: event.id,
          taskId: event.taskId,
          taskTitle: taskNames.get(event.taskId) ?? '',
          actorUserId: event.actorUserId,
          actorName: names.get(event.actorUserId) ?? '—',
          at: event.at,
          asManager: event.asManager,
          text: describeEvent(event, actor, {
            organizationId: actor.organizationId,
            user: (id) => names.get(id) ?? '—',
            contributor: (id) => contributorNames.get(id) ?? '—',
          }),
        })),
        team: users
          .filter((user) => tasks.some((task) => participates({ ...actor, userId: user.id }, task)))
          .map((user) => {
            const person = { ...actor, userId: user.id }
            const assigned = tasks.filter((task) => participates(person, task))
            const stats = collaboratorStats(tasks, actor.organizationId, user.id)
            return {
              user: { id: user.id, name: user.name, initials: user.initials, role: user.role },
              taskCount: stats.taskCount,
              completedPercentage: stats.completedPercentage,
              inProgress: assigned.filter(
                (task) => task.status === 'in_progress' || task.status === 'review',
              ).length,
              agingCount: aging.filter((task) => participates(person, task)).length,
              overdueCount: overdue.filter((task) => participates(person, task)).length,
              blockedCount: assigned.filter(isBlocked).length,
              lastUpdatedAt: lastActorUpdate(tasks, events, user.id),
            }
          }),
      },
    }
  }

  /** Adesão, ciclo, lead time, vazão e a série das seis semanas. Só com `flowMetrics` disponível. */
  private flowInsights(
    tasks: readonly Task[],
    events: readonly TimelineEvent[],
    weeks: ReturnType<typeof flowWeeks>,
    now: string,
  ): FlowInsights {
    const current = flowMetrics(tasks, events, weeks[5]!, now)
    return { ...current, weeks: flowSeries(tasks, events, weeks, now) }
  }
}
