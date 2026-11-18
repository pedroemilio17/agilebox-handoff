import { canSeeProject, moduleStateOf } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { ProjectDto } from '@agilebox/contract'
import { toProjectDto } from '../../mappers'
import type {
  DefinitionOfDoneRepository,
  ProjectModulesRepository,
  ProjectRepository,
} from '../../ports'

export class ListProjects {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly definitionOfDone: DefinitionOfDoneRepository,
    private readonly projectModules: ProjectModulesRepository,
  ) {}

  /** Padrão: projetos arquivados ficam de fora; `includeArchived` mostra todos. */
  async execute(
    actor: Actor,
    input?: { readonly includeArchived?: boolean | undefined },
  ): Promise<readonly ProjectDto[]> {
    const projects = (await this.projects.list(actor.organizationId)).filter(
      (project) => project.archivedAt === null || input?.includeArchived === true,
    )
    const counts = new Map<string, number>()
    for (const item of await this.definitionOfDone.listByOrganization(actor.organizationId)) {
      counts.set(item.projectId, (counts.get(item.projectId) ?? 0) + 1)
    }
    const visible = await Promise.all(
      projects.map(async (project) => {
        const members = await this.projects.listMembers(actor.organizationId, project.id)
        if (
          !canSeeProject(
            actor,
            project,
            members.some((member) => member.userId === actor.userId),
          )
        )
          return null
        // Contagem dos itens em vigor: com o módulo `definitionOfDone` desligado, vale zero (ADR-10).
        const modules = await this.projectModules.list(actor.organizationId, project.id)
        const inForce =
          moduleStateOf(modules, 'definitionOfDone') === 'disabled'
            ? 0
            : (counts.get(project.id) ?? 0)
        return toProjectDto(project, inForce)
      }),
    )
    return visible.filter((project): project is ProjectDto => project !== null)
  }
}
