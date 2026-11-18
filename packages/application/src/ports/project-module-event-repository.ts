import type { ModuleId, OrganizationId, ProjectId, UserId, UserRole } from '@agilebox/core'

/** O que aconteceu com o módulo no projeto (ADR-10, linha do tempo do projeto). */
export type ProjectModuleEventAction =
  'enabled' | 'disabled' | 'winding_down' | 'scheduled_disable' | 'cancelled'

/** Evento já com os dados de negócio; o id é atribuído pela persistência. */
export interface NewProjectModuleEvent {
  readonly organizationId: OrganizationId
  readonly projectId: ProjectId
  readonly moduleId: ModuleId
  readonly action: ProjectModuleEventAction
  readonly actorId: UserId
  /** Papel de quem fez a mudança no momento (`manager` marca "Gestor" na tela). */
  readonly actorRole: UserRole
  /** Mudou por dependência (cascata), e não por pedido direto. */
  readonly auto: boolean
  /** Módulo que puxou a mudança quando `auto` é verdadeiro; nulo nos demais casos. */
  readonly relatedModuleId: ModuleId | null
  readonly at: string
}

export interface ProjectModuleEvent extends NewProjectModuleEvent {
  readonly id: number
}

/**
 * Histórico de mudanças de módulos por projeto. Só cresce: não há atualização nem exclusão. Toda
 * leitura recebe a organização e só devolve eventos dela.
 */
export interface ProjectModuleEventRepository {
  /** Grava os eventos em ordem. Lista vazia não grava nada. */
  append(organizationId: OrganizationId, events: readonly NewProjectModuleEvent[]): Promise<void>
  /** Eventos do projeto, do mais recente para o mais antigo (`at`, depois `id`), até `limit`. */
  listByProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
    limit: number,
  ): Promise<readonly ProjectModuleEvent[]>
}
