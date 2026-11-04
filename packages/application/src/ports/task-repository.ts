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
  listRecent(organizationId: OrganizationId, userId: UserId): Promise<readonly Task[]>
  listFrequent(organizationId: OrganizationId, userId: UserId): Promise<readonly Task[]>
  search(organizationId: OrganizationId, query: string, userId: UserId): Promise<readonly Task[]>
  /** Próximo número da sequência da organização (MAX + 1). Chamar dentro da mesma transação do save. */
  nextNumber(organizationId: OrganizationId): Promise<number>
  save(organizationId: OrganizationId, task: Task): Promise<void>
}
