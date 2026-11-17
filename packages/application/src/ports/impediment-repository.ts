import type { Impediment, ImpedimentId, OrganizationId, TaskId, UserId } from '@agilebox/core'

/** Filtro da lista da organização: o padrão traz só os abertos. */
export interface ImpedimentListFilter {
  readonly ownerId?: UserId | undefined
  readonly includeResolved: boolean
}

/**
 * Impedimentos (M5.2a). Toda leitura recebe a organização. Histórico nunca é apagado: resolvido
 * continua no banco, e o registro aberto de uma tarefa é no máximo um.
 */
export interface ImpedimentRepository {
  findById(organizationId: OrganizationId, impedimentId: ImpedimentId): Promise<Impediment | null>
  /** O impedimento aberto da tarefa, se houver. */
  findOpenByTask(organizationId: OrganizationId, taskId: TaskId): Promise<Impediment | null>
  /** Todos os impedimentos da tarefa (resolvidos incluídos), do mais antigo para o mais novo. */
  listByTask(organizationId: OrganizationId, taskId: TaskId): Promise<readonly Impediment[]>
  /** Impedimentos abertos das tarefas pedidas, em lote (cartões e listas). */
  listOpenByTasks(
    organizationId: OrganizationId,
    taskIds: readonly TaskId[],
  ): Promise<readonly Impediment[]>
  /** Impedimentos da organização; sem `includeResolved`, só os abertos. Sem ordem garantida. */
  listByOrganization(
    organizationId: OrganizationId,
    filter: ImpedimentListFilter,
  ): Promise<readonly Impediment[]>
  /** Total registrado (abertos e resolvidos), para a prévia de impacto. */
  countByOrganization(organizationId: OrganizationId): Promise<number>
  /** Grava o impedimento (insere ou atualiza). Dentro da transação da tarefa. */
  save(organizationId: OrganizationId, impediment: Impediment): Promise<void>
}
