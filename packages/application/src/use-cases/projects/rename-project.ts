import {
  canRenameProject,
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  renameProject,
  toProjectId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { ProjectDto, RenameProjectInput } from '@agilebox/contract'
import { toProjectDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { definitionItemsInForce } from './definition-of-done-in-force'

/**
 * Renomeia o projeto. Só o gestor e quem criou o projeto; arquivado não se renomeia;
 * nome já usado por outro projeto da mesma organização é recusado (não há fusão).
 */
export class RenameProject {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: RenameProjectInput): Promise<ProjectDto> {
    const projectId = toProjectId(input.projectId)
    const project = await this.deps.projects.findById(actor.organizationId, projectId)
    if (!project) throw new NotFoundError('Projeto não encontrado')
    if (!canRenameProject(actor, project))
      throw new PermissionDeniedError('Sem permissão para renomear este projeto')
    const renamed = renameProject(project, input.name)
    const updated = await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      const sameName = await repositories.projects.findByNameKey(
        actor.organizationId,
        renamed.nameKey,
      )
      if (sameName && sameName.id !== project.id)
        throw new ConflictError('Já existe um projeto com este nome')
      await repositories.projects.save(actor.organizationId, renamed)
      return renamed
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'project',
      ids: [project.id],
    })
    const items = await definitionItemsInForce(this.deps, actor.organizationId, project.id)
    return toProjectDto(updated, items.length)
  }
}
