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

/**
 * Pedido de gravação de um módulo do projeto. Três casos para `config`:
 * - ausente (`undefined`): a configuração anterior é preservada;
 * - objeto: passa a ser a configuração gravada;
 * - `null`: a configuração é apagada, e o projeto volta a herdar a da equipe.
 */
export interface ProjectModuleChange {
  readonly moduleId: ModuleId
  readonly state: ModuleState
  readonly config?: TeamModuleConfig | null
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
  /**
   * Estado de um módulo em cada projeto NÃO arquivado da organização: uma entrada por projeto, e
   * projeto sem linha conta como `disabled`. Projeto arquivado não entra. Lista vazia quer dizer que
   * a organização não tem nenhum projeto ativo. Só lê dados da organização pedida (ADR-10, regra de
   * casos de uso sem projeto nos argumentos).
   */
  statesAcrossProjects(
    organizationId: OrganizationId,
    moduleId: ModuleId,
  ): Promise<readonly ModuleState[]>
}
