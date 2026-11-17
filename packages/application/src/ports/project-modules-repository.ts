import type {
  ModuleId,
  ModuleState,
  OrganizationId,
  ProjectId,
  TeamModuleConfig,
  UserId,
} from '@agilebox/core'

/**
 * Como um módulo está num projeto (ADR-10). `config` é nulo quando a linha não tem configuração;
 * `changedBy` e `changedAt` são nulos quando ninguém gravou a linha (padrão ou migração).
 */
export interface ProjectModuleSetting {
  readonly moduleId: ModuleId
  readonly state: ModuleState
  readonly config: TeamModuleConfig | null
  readonly changedBy: UserId | null
  readonly changedAt: string | null
}

/** Pedido de gravação de um módulo do projeto. Sem `config`, a configuração anterior é preservada. */
export interface ProjectModuleChange {
  readonly moduleId: ModuleId
  readonly state: ModuleState
  readonly config?: TeamModuleConfig
}

/**
 * Módulos ligados em cada projeto. Toda leitura e gravação recebe a organização e só toca nas
 * linhas dela. Módulo sem linha conta como desligado.
 */
export interface ProjectModulesRepository {
  /** Linhas gravadas do projeto, em ordem do catálogo. Projeto sem linhas devolve lista vazia. */
  list(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<readonly ProjectModuleSetting[]>
  /**
   * Grava as mudanças de forma atômica (upsert). Nunca apaga linhas: módulos fora do pedido ficam
   * como estão. Pedido inválido, módulo repetido, ator ou projeto de outra organização (ou
   * inexistente) são recusados com `ValidationError`, sem gravar nada.
   */
  save(
    organizationId: OrganizationId,
    projectId: ProjectId,
    changes: readonly ProjectModuleChange[],
    actorId: UserId,
    at: string,
  ): Promise<void>
}
