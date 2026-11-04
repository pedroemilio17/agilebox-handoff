import { canSeeProject } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { ProjectDto } from '@agilebox/contract'
import { toProjectDto } from '../../mappers'
import type { DefinitionOfDoneRepository, ProjectRepository } from '../../ports'

export class ListProjects {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly definitionOfDone: DefinitionOfDoneRepository,
  ) {}

  async execute(actor: Actor): Promise<readonly ProjectDto[]> {
    const projects = await this.projects.list(actor.organizationId)
    const counts = new Map<string, number>()
    for (const item of await this.definitionOfDone.listByOrganization(actor.organizationId)) {
      counts.set(item.projectId, (counts.get(item.projectId) ?? 0) + 1)
    }
    const visible = await Promise.all(
      projects.map(async (project) => {
        const members = await this.projects.listMembers(actor.organizationId, project.id)
        return canSeeProject(
          actor,
          project,
          members.some((member) => member.userId === actor.userId),
        )
          ? toProjectDto(project, counts.get(project.id) ?? 0)
          : null
      }),
    )
    return visible.filter((project): project is ProjectDto => project !== null)
  }
}
