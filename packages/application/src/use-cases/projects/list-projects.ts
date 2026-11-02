import { canSeeProject } from '@agilebox/core'
import type { Actor, TenantContext } from '@agilebox/core'
import type { ProjectDto } from '@agilebox/contract'
import { toProjectDto } from '../../mappers'
import type { ProjectRepository } from '../../ports'
import { assertTenant } from '../tenant-scope'

export class ListProjects {
  constructor(private readonly projects: ProjectRepository) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    options: { readonly includeArchived?: boolean | undefined } = {},
  ): Promise<readonly ProjectDto[]> {
    const organizationId = assertTenant(ctx, actor)
    const projects = (await this.projects.list(organizationId)).filter(
      (project) => options.includeArchived || project.archivedAt === null,
    )
    const visible = await Promise.all(
      projects.map(async (project) => {
        const members = await this.projects.listMembers(organizationId, project.id)
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
