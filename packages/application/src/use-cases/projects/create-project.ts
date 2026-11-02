import { createProject, toProjectId } from '@agilebox/core'
import type { Actor, TenantContext } from '@agilebox/core'
import type { CreateProjectInput, ProjectDto } from '@agilebox/contract'
import { toProjectDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { assertTenant } from '../tenant-scope'

export class CreateProject {
  constructor(private readonly deps: AppDeps) {}

  async execute(ctx: TenantContext, actor: Actor, input: CreateProjectInput): Promise<ProjectDto> {
    const organizationId = assertTenant(ctx, actor)
    const candidate = createProject({
      id: toProjectId(await this.deps.idGenerator.generate(organizationId)),
      organizationId,
      name: input.name,
      createdBy: actor.userId,
      createdAt: await this.deps.clock.now(organizationId),
    })
    const existing = await this.deps.projects.findActiveByNameKey(organizationId, candidate.nameKey)
    // Projeto arquivado com o mesmo nome não é reaproveitado: cria-se um projeto novo.
    if (existing) return toProjectDto(existing)
    const project = await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const raced = await repositories.projects.findActiveByNameKey(
        organizationId,
        candidate.nameKey,
      )
      if (raced) return raced
      await repositories.projects.save(organizationId, candidate)
      await repositories.projects.addMember(organizationId, {
        projectId: candidate.id,
        userId: actor.userId,
        addedBy: actor.userId,
        addedAt: candidate.createdAt,
      })
      return candidate
    })
    if (project.id === candidate.id) {
      await this.deps.changeNotifier.publish(organizationId, {
        kind: 'project',
        ids: [project.id],
      })
    }
    return toProjectDto(project)
  }
}
