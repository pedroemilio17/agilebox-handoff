import { collaboratorStats, PermissionDeniedError, statusPercentages } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
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

    return toDashboardDto(statusPercentages(tasks), collaborators)
  }
}
