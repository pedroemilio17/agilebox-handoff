import {
  canManageMembers,
  createProject,
  NotFoundError,
  PermissionDeniedError,
  toProjectId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { AppDeps } from '../../deps'

export class RenameProject {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly projectId: string; readonly name: string }) {
    const project = await this.deps.projects.findById(
      actor.organizationId,
      toProjectId(input.projectId),
    )
    if (!project) throw new NotFoundError('Projeto não encontrado')
    if (!canManageMembers(actor, project))
      throw new PermissionDeniedError('Sem permissão para editar este projeto')
    const renamed = createProject({ ...project, name: input.name })
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.projects.save(actor.organizationId, renamed)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'project',
      ids: [project.id],
    })
    return renamed
  }
}
