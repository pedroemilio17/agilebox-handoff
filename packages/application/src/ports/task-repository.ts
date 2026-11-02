import type { OrganizationId, ProjectId, TaskId, UserId } from '@agilebox/core'
import type { BacklogRankChange, Task } from '@agilebox/core'

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
   * Backlog do time: tarefas com posição, da primeira à última, sem as arquivadas (M3.9). Não
   * filtra por participante nem por quadro; isso é decidido no caso de uso.
   */
  listBacklog(organizationId: OrganizationId): Promise<readonly Task[]>
  /**
   * Grava, numa transação só, as posições alteradas do backlog (`{id, backlogRank}`): ou todas
   * entram, ou nenhuma. Posição inválida recusa o lote inteiro. Tarefa de outra organização ou
   * inexistente é ignorada, como em `save`.
   */
  saveBacklogRanks(
    organizationId: OrganizationId,
    changes: readonly BacklogRankChange[],
  ): Promise<void>
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
