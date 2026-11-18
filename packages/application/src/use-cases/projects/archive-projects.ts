import {
  archiveProject,
  canArchiveProject,
  NotFoundError,
  PermissionDeniedError,
  toProjectId,
  unarchiveProject,
} from '@agilebox/core'
import type { Actor, Project } from '@agilebox/core'
import type { ProjectDto } from '@agilebox/contract'
import { toProjectDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { definitionItemsInForce } from './definition-of-done-in-force'

abstract class ChangeProjectArchive {
  constructor(protected readonly deps: AppDeps) {}

  protected async change(
    actor: Actor,
    rawProjectId: string,
    transform: (project: Project, by: Actor['userId'], now: string) => Project,
  ): Promise<ProjectDto> {
    const projectId = toProjectId(rawProjectId)
    const project = await this.deps.projects.findById(actor.organizationId, projectId)
    if (!project) throw new NotFoundError('Projeto não encontrado')
    if (!canArchiveProject(actor, project))
      throw new PermissionDeniedError('Sem permissão para arquivar ou desarquivar este projeto')
    const now = await this.deps.clock.now(actor.organizationId)
    const updated = transform(project, actor.userId, now)
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.projects.save(actor.organizationId, updated)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'project',
      ids: [project.id],
    })
    const items = await definitionItemsInForce(this.deps, actor.organizationId, project.id)
    return toProjectDto(updated, items.length)
  }
}

/** Arquiva (esconde, nunca apaga). Só o gestor e quem criou o projeto. */
export class ArchiveProject extends ChangeProjectArchive {
  async execute(actor: Actor, input: { readonly projectId: string }): Promise<ProjectDto> {
    return this.change(actor, input.projectId, (project, by, now) =>
      archiveProject(project, by, now),
    )
  }
}

/** Desarquiva: as tarefas do projeto voltam às visões padrão como estavam. */
export class UnarchiveProject extends ChangeProjectArchive {
  async execute(actor: Actor, input: { readonly projectId: string }): Promise<ProjectDto> {
    return this.change(actor, input.projectId, (project) => unarchiveProject(project))
  }
}
