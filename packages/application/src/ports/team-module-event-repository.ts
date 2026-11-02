import type { ModuleId, ModuleState, OrganizationId, UserId } from '@agilebox/core'

/** Uma mudança de estado de módulo, gravada na mesma transação da mudança (D7). */
export interface TeamModuleEvent {
  readonly id: string
  readonly moduleId: ModuleId
  readonly fromState: ModuleState
  readonly toState: ModuleState
  readonly changedBy: UserId
  readonly changedAt: string
}

export interface TeamModuleEventRepository {
  /** Acrescenta um evento ao histórico do time. Eventos nunca são alterados nem apagados. */
  append(organizationId: OrganizationId, event: TeamModuleEvent): Promise<void>
  /** Eventos do time em ordem cronológica (data e depois id). */
  list(organizationId: OrganizationId): Promise<readonly TeamModuleEvent[]>
}
