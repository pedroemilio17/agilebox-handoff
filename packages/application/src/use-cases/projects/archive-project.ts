import { canManageMembers, NotFoundError, PermissionDeniedError, toProjectId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { AppDeps } from '../../deps'

abstract class ChangeProjectArchive {
  constructor(protected readonly deps: AppDeps) {}

  protected async setArchived(actor: Actor, projectId: string, archived: boolean): Promise<void> {
    const project = await this.deps.projects.findById(actor.organizationId, toProjectId(projectId))
    if (!project) throw new NotFoundError('Projeto não encontrado')
    if (!canManageMembers(actor, project))
      throw new PermissionDeniedError('Sem permissão para editar este projeto')
    const archivedAt = archived ? await this.deps.clock.now(actor.organizationId) : null
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.projects.save(actor.organizationId, { ...project, archivedAt })
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'project',
      ids: [project.id],
    })
  }
}

export class ArchiveProject extends ChangeProjectArchive {
  async execute(actor: Actor, input: { readonly projectId: string }): Promise<void> {
    await this.setArchived(actor, input.projectId, true)
  }
}

export class UnarchiveProject extends ChangeProjectArchive {
  async execute(actor: Actor, input: { readonly projectId: string }): Promise<void> {
    await this.setArchived(actor, input.projectId, false)
  }
}
