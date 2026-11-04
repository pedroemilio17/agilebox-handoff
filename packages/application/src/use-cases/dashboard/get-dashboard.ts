import {
  collaboratorStats,
  PermissionDeniedError,
  statusPercentages,
  toDateOnly,
  flowWeeks,
  flowMetrics,
  flowSnapshot,
  isStaleTask,
  isOverdueTask,
  recentChanges,
  lastActorUpdate,
  participates,
  describeEvent,
} from '@agilebox/core'
import type { Actor, Task } from '@agilebox/core'
import type { DashboardDto } from '@agilebox/contract'
import { toDashboardDto } from '../../mappers'
import type { AppDeps } from '../../deps'

export class GetDashboard {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<DashboardDto> {
    if (actor.role !== 'manager')
      throw new PermissionDeniedError('Somente o gestor pode acessar o dashboard')

    const [tasks, users] = await Promise.all([
      this.deps.tasks.listBoard(actor.organizationId, {}),
      this.deps.users.list(actor.organizationId),
    ])
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
    const current = flowMetrics(tasks, events, weeks[5]!, now)
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
        ...current,
        agingCount: aging.length,
        overdueCount: overdue.length,
        blockedCount: tasks.filter(isBlocked).length,
        weeks: weeks.map((week, index) => {
          const end = new Date(`${week.endExclusive}T00:00:00`)
          const at = index === weeks.length - 1 ? now : new Date(end.getTime() - 1).toISOString()
          const snapshot = index === weeks.length - 1 ? tasks : flowSnapshot(tasks, events, at)
          return { start: week.start, ...flowMetrics(snapshot, events, week, at) }
        }),
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
            return {
              user: { id: user.id, name: user.name, initials: user.initials, role: user.role },
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
}
