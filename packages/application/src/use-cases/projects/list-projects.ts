import { canSeeProject } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { ProjectDto } from '@agilebox/contract'
import { toProjectDto } from '../../mappers'
import type { ProjectRepository } from '../../ports'

export class ListProjects {
  constructor(private readonly projects: ProjectRepository) {}

  async execute(
    actor: Actor,
    options: { readonly includeArchived?: boolean } = {},
  ): Promise<readonly ProjectDto[]> {
    const projects = (await this.projects.list(actor.organizationId)).filter(
      (project) => options.includeArchived || project.archivedAt === null,
    )
    const visible = await Promise.all(
      projects.map(async (project) => {
        const members = await this.projects.listMembers(actor.organizationId, project.id)
        return canSeeProject(
          actor,
          project,
          members.some((member) => member.userId === actor.userId),
        )
          ? toProjectDto(project)
          : null
      }),
    )
    return visible.filter((project): project is ProjectDto => project !== null)
  }
}
