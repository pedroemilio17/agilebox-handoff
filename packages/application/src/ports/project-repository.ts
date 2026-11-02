import type { OrganizationId, ProjectId, UserId } from '@agilebox/core'
import type { Project } from '@agilebox/core'

export interface ProjectMember {
  readonly projectId: ProjectId
  readonly userId: UserId
  readonly addedBy: UserId
  readonly addedAt: string
}

export interface ProjectRepository {
  findById(organizationId: OrganizationId, projectId: ProjectId): Promise<Project | null>
  findByNameKey(organizationId: OrganizationId, nameKey: string): Promise<Project | null>
  /** Só projetos ativos: a duplicidade de nome ignora os arquivados. */
  findActiveByNameKey(organizationId: OrganizationId, nameKey: string): Promise<Project | null>
  list(organizationId: OrganizationId): Promise<readonly Project[]>
  save(organizationId: OrganizationId, project: Project): Promise<void>
  listMembers(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<readonly ProjectMember[]>
  addMember(organizationId: OrganizationId, member: ProjectMember): Promise<void>
  removeMember(organizationId: OrganizationId, projectId: ProjectId, userId: UserId): Promise<void>
}
