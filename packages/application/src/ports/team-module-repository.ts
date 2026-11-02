import type { ModuleId, ModuleState, OrganizationId, UserId } from '@agilebox/core'

/** Configuração própria de um módulo: só valores simples, para caber em JSON. */
export type TeamModuleConfig = Readonly<Record<string, string | number | boolean | null>>

/** Estado de um módulo dentro de um time (time = organização, D1). */
export interface TeamModule {
  readonly moduleId: ModuleId
  readonly state: ModuleState
  readonly config: TeamModuleConfig
  readonly changedBy: UserId
  readonly changedAt: string
}

export interface TeamModuleRepository {
  /** Módulos gravados do time, na ordem do catálogo. Módulo nunca gravado não aparece. */
  list(organizationId: OrganizationId): Promise<readonly TeamModule[]>
  /** Grava ou substitui o estado do módulo no time. */
  save(organizationId: OrganizationId, teamModule: TeamModule): Promise<void>
}
