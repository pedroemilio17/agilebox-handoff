import {
  canManageMembers,
  createProject,
  NotFoundError,
  PermissionDeniedError,
  toProjectId,
} from '@agilebox/core'
import type { Actor, TenantContext } from '@agilebox/core'
import type { AppDeps } from '../../deps'
import { assertTenant } from '../tenant-scope'

export class RenameProject {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: { readonly projectId: string; readonly name: string },
  ) {
    const organizationId = assertTenant(ctx, actor)
    const project = await this.deps.projects.findById(organizationId, toProjectId(input.projectId))
    if (!project) throw new NotFoundError('Projeto não encontrado')
    if (!canManageMembers(actor, project))
      throw new PermissionDeniedError('Sem permissão para editar este projeto')
    const renamed = createProject({ ...project, name: input.name })
    await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      await repositories.projects.save(organizationId, renamed)
    })
    await this.deps.changeNotifier.publish(organizationId, {
      kind: 'project',
      ids: [project.id],
    })
    return renamed
  }
}
