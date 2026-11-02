import { canViewTask, NotFoundError, PermissionDeniedError, toTaskId } from '@agilebox/core'
import type { Actor, ContributorId, TenantContext, TimelineNames, UserId } from '@agilebox/core'
import type { TimelineEventDto } from '@agilebox/contract'
import { toTimelineEventDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { assertTenant } from '../tenant-scope'

export class ListTimeline {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: { readonly taskId: string },
  ): Promise<readonly TimelineEventDto[]> {
    const organizationId = assertTenant(ctx, actor)
    const task = await this.deps.tasks.findById(organizationId, toTaskId(input.taskId))
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    const members = await this.deps.projects.listMembers(organizationId, task.projectId)
    if (
      !canViewTask(
        actor,
        task,
        members.some((member) => member.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError('Sem acesso a esta tarefa')

    const [events, users, contributors] = await Promise.all([
      this.deps.timeline.listByTask(organizationId, task.id),
      this.deps.users.list(organizationId),
      this.deps.contributors.list(organizationId),
    ])
    const userNames = new Map<UserId, string>(users.map((user) => [user.id, user.name]))
    const contributorNames = new Map<ContributorId, string>(
      contributors.map((contributor) => [contributor.id, contributor.name]),
    )
    const names: TimelineNames = {
      organizationId,
      user: (id) => userNames.get(id) ?? 'Usuário',
      contributor: (id) => contributorNames.get(id) ?? 'Entidade',
    }

    return [...events]
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      .map((event) => toTimelineEventDto(event, actor, names))
  }
}
