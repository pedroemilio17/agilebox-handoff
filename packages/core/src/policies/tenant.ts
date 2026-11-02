import { ValidationError } from '../shared/errors'
import type { OrganizationId } from '../shared/ids'
import type { Actor } from './actor'

/**
 * Contexto de time (tenant) exigido por todo caso de uso (D1, D9).
 * Organização é o time: o contexto só embrulha o `organizationId` do ator.
 */
export interface TenantContext {
  readonly organizationId: OrganizationId
}

/** Cria o contexto a partir do ator. Recusa ator sem time, sem gravar nada. */
export function createTenantContext(actor: Actor): TenantContext {
  const organizationId = actor.organizationId as string | undefined
  if (typeof organizationId !== 'string' || organizationId.length === 0) {
    throw new ValidationError('Contexto de time ausente')
  }
  return { organizationId: actor.organizationId }
}
