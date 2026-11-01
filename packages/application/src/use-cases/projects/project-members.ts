import {
  canManageMembers,
  canSeeProject,
  NotFoundError,
  PermissionDeniedError,
  toProjectId,
  toUserId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { AddProjectMemberInput, UserSummaryDto } from '@agilebox/contract'
import { toUserSummaryDto } from '../../mappers'
import type { AppDeps } from '../../deps'

export class ListProjectMembers {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: { readonly projectId: string },
  ): Promise<readonly UserSummaryDto[]> {
    const project = await this.deps.projects.findById(
      actor.organizationId,
      toProjectId(input.projectId),
    )
    if (!project) throw new NotFoundError('Projeto não encontrado')
    const members = await this.deps.projects.listMembers(actor.organizationId, project.id)
    if (
      !canSeeProject(
        actor,
        project,
        members.some((member) => member.userId === actor.userId),
      )
    ) {
      throw new PermissionDeniedError('Sem acesso a este projeto')
    }
    const users = await Promise.all(
      members.map((member) => this.deps.users.findById(actor.organizationId, member.userId)),
    )
    return users.filter((user) => user !== null).map(toUserSummaryDto)
  }
}

abstract class ChangeProjectMember {
  constructor(protected readonly deps: AppDeps) {}

  protected async getManageableProject(actor: Actor, projectId: string) {
    const project = await this.deps.projects.findById(actor.organizationId, toProjectId(projectId))
    if (!project) throw new NotFoundError('Projeto não encontrado')
    if (!canManageMembers(actor, project))
      throw new PermissionDeniedError('Sem permissão para gerenciar membros')
    return project
  }

  protected async notify(actor: Actor, projectId: string): Promise<void> {
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'project',
      ids: [projectId],
    })
  }
}

export class AddProjectMember extends ChangeProjectMember {
  async execute(actor: Actor, input: AddProjectMemberInput): Promise<void> {
    const project = await this.getManageableProject(actor, input.projectId)
    const userId = toUserId(input.userId)
    if (!(await this.deps.users.findById(actor.organizationId, userId)))
      throw new NotFoundError('Usuário não encontrado')
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      const members = await repositories.projects.listMembers(actor.organizationId, project.id)
      if (!members.some((member) => member.userId === userId)) {
        await repositories.projects.addMember(actor.organizationId, {
          projectId: project.id,
          userId,
          addedBy: actor.userId,
          addedAt: await this.deps.clock.now(actor.organizationId),
        })
      }
    })
    await this.notify(actor, project.id)
  }
}

export class RemoveProjectMember extends ChangeProjectMember {
  async execute(actor: Actor, input: AddProjectMemberInput): Promise<void> {
    const project = await this.getManageableProject(actor, input.projectId)
    const userId = toUserId(input.userId)
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.projects.removeMember(actor.organizationId, project.id, userId)
    })
    await this.notify(actor, project.id)
  }
}
