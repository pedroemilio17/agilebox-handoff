import type { Baseline, OrganizationId, ProjectId } from '@agilebox/core'

/**
 * Linhas de base do projeto (ADR-10, módulo `baseline`). Cada foto grava as tarefas junto e é
 * imutável: não há edição nem remoção. Guarda várias fotos; a comparação usa a mais recente
 * (`takenAt`). Projeto, gravador ou tarefa de outra organização são recusados com VALIDAÇÃO.
 */
export interface BaselineRepository {
  /** A foto mais recente do projeto, com as tarefas. Nula sem foto. */
  findLatestByProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<Baseline | null>
  /** Grava uma foto nova, com as suas tarefas. */
  add(organizationId: OrganizationId, baseline: Baseline): Promise<void>
}
