import { canViewTask, NotFoundError, PermissionDeniedError, toTaskId } from '@agilebox/core'
import type { Actor, ContributorId, TimelineNames, UserId } from '@agilebox/core'
import type { TimelineEventDto } from '@agilebox/contract'
import { toTimelineEventDto } from '../../mappers'
import type { AppDeps } from '../../deps'

export class ListTimeline {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: { readonly taskId: string },
  ): Promise<readonly TimelineEventDto[]> {
    const task = await this.deps.tasks.findById(actor.organizationId, toTaskId(input.taskId))
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    const members = await this.deps.projects.listMembers(actor.organizationId, task.projectId)
    if (
      !canViewTask(
        actor,
        task,
        members.some((member) => member.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError('Sem acesso a esta tarefa')

    const [events, users, contributors] = await Promise.all([
      this.deps.timeline.listByTask(actor.organizationId, task.id),
      this.deps.users.list(actor.organizationId),
      this.deps.contributors.list(actor.organizationId),
    ])
    const userNames = new Map<UserId, string>(users.map((user) => [user.id, user.name]))
    const contributorNames = new Map<ContributorId, string>(
      contributors.map((contributor) => [contributor.id, contributor.name]),
    )
    const names: TimelineNames = {
      organizationId: actor.organizationId,
      user: (id) => userNames.get(id) ?? 'Usuário',
      contributor: (id) => contributorNames.get(id) ?? 'Entidade',
    }

    return [...events]
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      .map((event) => toTimelineEventDto(event, actor, names))
  }
}
