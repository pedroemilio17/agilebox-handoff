import { createProject, toProjectId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { CreateProjectInput, ProjectDto } from '@agilebox/contract'
import { toProjectDto } from '../../mappers'
import type { AppDeps } from '../../deps'

export class CreateProject {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: CreateProjectInput): Promise<ProjectDto> {
    const candidate = createProject({
      id: toProjectId(await this.deps.idGenerator.generate(actor.organizationId)),
      organizationId: actor.organizationId,
      name: input.name,
      createdBy: actor.userId,
      createdAt: await this.deps.clock.now(actor.organizationId),
    })
    const existing = await this.deps.projects.findByNameKey(actor.organizationId, candidate.nameKey)
    // Projeto arquivado com o mesmo nome não é reaproveitado: cria-se um projeto novo.
    if (existing && existing.archivedAt === null) return toProjectDto(existing)
    const project = await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      const raced = await repositories.projects.findByNameKey(
        actor.organizationId,
        candidate.nameKey,
      )
      if (raced && raced.archivedAt === null) return raced
      await repositories.projects.save(actor.organizationId, candidate)
      await repositories.projects.addMember(actor.organizationId, {
        projectId: candidate.id,
        userId: actor.userId,
        addedBy: actor.userId,
        addedAt: candidate.createdAt,
      })
      return candidate
    })
    if (project.id === candidate.id) {
      await this.deps.changeNotifier.publish(actor.organizationId, {
        kind: 'project',
        ids: [project.id],
      })
    }
    return toProjectDto(project)
  }
}
