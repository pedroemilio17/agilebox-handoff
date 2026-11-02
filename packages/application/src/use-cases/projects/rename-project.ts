import {
  canRenameProject,
  createProject,
  NotFoundError,
  PermissionDeniedError,
  toProjectId,
  ValidationError,
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
    if (!canRenameProject(actor, project))
      throw new PermissionDeniedError('Sem permissão para editar este projeto')
    const renamed = createProject({ ...project, name: input.name })
    // Arquivado com o mesmo nome não conta; o próprio projeto também não (trocar só maiúsculas é válido).
    await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const sameName = await repositories.projects.findActiveByNameKey(
        organizationId,
        renamed.nameKey,
      )
      if (sameName && sameName.id !== project.id)
        throw new ValidationError('Já existe um projeto com este nome')
      await repositories.projects.save(organizationId, renamed)
    })
    await this.deps.changeNotifier.publish(organizationId, {
      kind: 'project',
      ids: [project.id],
    })
    return renamed
  }
}
