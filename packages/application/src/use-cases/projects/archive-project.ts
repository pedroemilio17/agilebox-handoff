import {
  canArchiveProject,
  NotFoundError,
  PermissionDeniedError,
  toProjectId,
  ValidationError,
} from '@agilebox/core'
import type { Actor, TenantContext } from '@agilebox/core'
import type { AppDeps } from '../../deps'
import { assertTenant } from '../tenant-scope'

abstract class ChangeProjectArchive {
  constructor(protected readonly deps: AppDeps) {}

  protected async setArchived(
    ctx: TenantContext,
    actor: Actor,
    projectId: string,
    archived: boolean,
  ): Promise<void> {
    const organizationId = assertTenant(ctx, actor)
    const project = await this.deps.projects.findById(organizationId, toProjectId(projectId))
    if (!project) throw new NotFoundError('Projeto não encontrado')
    if (!canArchiveProject(actor, project))
      throw new PermissionDeniedError('Sem permissão para editar este projeto')
    const archivedAt = archived ? await this.deps.clock.now(organizationId) : null
    await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      // Desarquivar volta o projeto a ativo: não pode haver outro ativo com o mesmo nome.
      if (archivedAt === null) {
        const sameName = await repositories.projects.findActiveByNameKey(
          organizationId,
          project.nameKey,
        )
        if (sameName && sameName.id !== project.id)
          throw new ValidationError('Já existe um projeto com este nome')
      }
      await repositories.projects.save(organizationId, { ...project, archivedAt })
    })
    await this.deps.changeNotifier.publish(organizationId, {
      kind: 'project',
      ids: [project.id],
    })
  }
}

export class ArchiveProject extends ChangeProjectArchive {
  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: { readonly projectId: string },
  ): Promise<void> {
    await this.setArchived(ctx, actor, input.projectId, true)
  }
}

export class UnarchiveProject extends ChangeProjectArchive {
  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: { readonly projectId: string },
  ): Promise<void> {
    await this.setArchived(ctx, actor, input.projectId, false)
  }
}
