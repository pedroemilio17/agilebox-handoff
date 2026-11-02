import type { OrganizationId, ProjectId, TaskId, UserId } from '@agilebox/core'
import type { Task } from '@agilebox/core'

export interface TaskListQuery {
  readonly projectId?: ProjectId
  readonly userId?: UserId
}

export interface TaskRepository {
  findById(organizationId: OrganizationId, taskId: TaskId): Promise<Task | null>
  findByProjectNameKey(
    organizationId: OrganizationId,
    projectId: ProjectId,
    nameKey: string,
  ): Promise<Task | null>
  listByProject(organizationId: OrganizationId, projectId: ProjectId): Promise<readonly Task[]>
  listBoard(organizationId: OrganizationId, query: TaskListQuery): Promise<readonly Task[]>
  /**
   * Tarefas arquivadas da organização, das mais recentes para as mais antigas. Não filtra por
   * participante: quem vê cada uma é decidido no caso de uso (M3.0b).
   */
  listArchived(organizationId: OrganizationId): Promise<readonly Task[]>
  listRecent(organizationId: OrganizationId, userId: UserId): Promise<readonly Task[]>
  listFrequent(organizationId: OrganizationId, userId: UserId): Promise<readonly Task[]>
  search(organizationId: OrganizationId, query: string, userId: UserId): Promise<readonly Task[]>
  save(organizationId: OrganizationId, task: Task): Promise<void>
  /** Quantas tarefas (inclusive arquivadas) a organização tem. Usada pela prévia de impacto. */
  count(organizationId: OrganizationId): Promise<number>
}
