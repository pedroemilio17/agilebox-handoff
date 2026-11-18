import type {
  Deliverable,
  DeliverableId,
  Milestone,
  MilestoneId,
  OrganizationId,
  ProjectId,
} from '@agilebox/core'

/**
 * Entregas da EAP (ADR-10). Toda leitura e escrita recebe a organização. Gravar com pai, projeto ou
 * criador de outra organização (ou pai de outro projeto) é recusado com VALIDAÇÃO.
 */
export interface DeliverableRepository {
  /** Entregas do projeto, ordenadas por pai e depois por posição entre os irmãos. */
  listByProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<readonly Deliverable[]>
  findById(
    organizationId: OrganizationId,
    deliverableId: DeliverableId,
  ): Promise<Deliverable | null>
  /** Insere ou atualiza uma entrega. */
  save(organizationId: OrganizationId, deliverable: Deliverable): Promise<void>
  /** Grava várias entregas (reordenação de irmãos). Chamar dentro da transação do UnitOfWork. */
  saveMany(organizationId: OrganizationId, deliverables: readonly Deliverable[]): Promise<void>
  /** Quantos filhos diretos a entrega tem. */
  countChildren(organizationId: OrganizationId, deliverableId: DeliverableId): Promise<number>
  /** Quantas tarefas apontam para a entrega. */
  countTasks(organizationId: OrganizationId, deliverableId: DeliverableId): Promise<number>
  /** Quantos marcos apontam para a entrega. */
  countMilestones(organizationId: OrganizationId, deliverableId: DeliverableId): Promise<number>
  /**
   * Apaga a entrega, só se não tem filhos, tarefas nem marcos ligados. Caso contrário recusa com
   * CONFLITO, sem apagar nada.
   */
  delete(organizationId: OrganizationId, deliverableId: DeliverableId): Promise<void>
}

/** Marcos do projeto (ADR-10). Mesma regra de organização e de vínculo da entrega. */
export interface MilestoneRepository {
  /** Marcos do projeto, ordenados pela data-alvo. */
  listByProject(organizationId: OrganizationId, projectId: ProjectId): Promise<readonly Milestone[]>
  findById(organizationId: OrganizationId, milestoneId: MilestoneId): Promise<Milestone | null>
  /** Insere ou atualiza. Entrega ligada precisa ser do mesmo projeto e da organização. */
  save(organizationId: OrganizationId, milestone: Milestone): Promise<void>
  delete(organizationId: OrganizationId, milestoneId: MilestoneId): Promise<void>
}
