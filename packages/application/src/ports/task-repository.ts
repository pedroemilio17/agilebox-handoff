import type { OrganizationId, ProjectId, TaskId, UserId } from '@agilebox/core'
import type { Task } from '@agilebox/core'
import type { BacklogRankChange } from '@agilebox/core'

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
  /** Tarefas pelos ids, em lote (só as que existem na organização). Sem ordem garantida. */
  findManyById(organizationId: OrganizationId, taskIds: readonly TaskId[]): Promise<readonly Task[]>
  listBoard(organizationId: OrganizationId, query: TaskListQuery): Promise<readonly Task[]>
  listRecent(organizationId: OrganizationId, userId: UserId): Promise<readonly Task[]>
  listFrequent(organizationId: OrganizationId, userId: UserId): Promise<readonly Task[]>
  search(organizationId: OrganizationId, query: string, userId: UserId): Promise<readonly Task[]>
  /** Tarefa pelo número da sequência, só se o usuário puder vê-la. */
  findByNumber(organizationId: OrganizationId, number: number, userId: UserId): Promise<Task | null>
  /** Itens de backlog do projeto (posição não nula), sem ordem garantida: quem chama ordena. */
  listBacklog(organizationId: OrganizationId, projectId: ProjectId): Promise<readonly Task[]>
  /** Grava só as posições de backlog que mudaram (dentro da transação da reordenação). */
  updateBacklogRanks(
    organizationId: OrganizationId,
    changes: readonly BacklogRankChange[],
  ): Promise<void>
  /** Próximo número da sequência da organização (MAX + 1). Chamar dentro da mesma transação do save. */
  nextNumber(organizationId: OrganizationId): Promise<number>
  save(organizationId: OrganizationId, task: Task): Promise<void>
}
