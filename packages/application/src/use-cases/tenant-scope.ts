import { PermissionDeniedError } from '@agilebox/core'
import type { Actor, OrganizationId, TenantContext } from '@agilebox/core'

/**
 * Confere que o contexto de time é o do ator e devolve o time para escopar as consultas.
 * Contexto de outro time é recusado antes de qualquer leitura ou escrita (M1.10a).
 */
export function assertTenant(ctx: TenantContext, actor: Actor): OrganizationId {
  if (ctx.organizationId !== actor.organizationId)
    throw new PermissionDeniedError('Contexto de time não confere com o ator')
  return ctx.organizationId
}
