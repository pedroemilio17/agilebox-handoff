import type { Task } from '../entities/task'
import { participates } from '../policies/access-policy'
import type { OrganizationId, UserId } from '../shared/ids'
import { TASK_STATUSES } from '../values/task-status'
import type { TaskStatus } from '../values/task-status'

export type StatusDistribution = Record<TaskStatus, number>

export function statusPercentages(tasks: readonly Task[]): StatusDistribution {
  const counts: StatusDistribution = { planning: 0, todo: 0, in_progress: 0, review: 0, done: 0 }
  for (const task of tasks) counts[task.status]++
  const result: StatusDistribution = { planning: 0, todo: 0, in_progress: 0, review: 0, done: 0 }
  if (tasks.length === 0) return result

  const remainders = TASK_STATUSES.map((status, order) => {
    const numerator = counts[status] * 100
    result[status] = Math.floor(numerator / tasks.length)
    return { status, order, remainder: numerator % tasks.length }
  }).sort((a, b) => b.remainder - a.remainder || a.order - b.order)
  const remaining = 100 - TASK_STATUSES.reduce((sum, status) => sum + result[status], 0)
  for (const entry of remainders.slice(0, remaining)) result[entry.status]++
  return result
}

export function collaboratorStats(
  tasks: readonly Task[],
  organizationId: OrganizationId,
  userId: UserId,
) {
  const actor = { organizationId, userId, role: 'collaborator' as const }
  const participatingTasks = tasks.filter((task) => participates(actor, task))
  const distribution = statusPercentages(participatingTasks)
  return {
    taskCount: participatingTasks.length,
    distribution,
    completedPercentage: distribution.done,
  }
}
