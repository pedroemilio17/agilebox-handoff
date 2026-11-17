import type { Actor, OrganizationId } from '@agilebox/core'

/**
 * Contexto de execução que todo caso de uso registrado em `createUseCases` exige (PLANO-2.0,
 * "Camadas de defesa", item 1). É derivado só do ator da sessão, nunca de `userId` ou `tenantId`
 * vindos do pedido, do prompt ou de um modelo.
 *
 * `tenantId` é o `organizationId` do ator: no MVP, a organização é o time. Repositórios recebem
 * esse id; no M6a o Postgres reforça o mesmo filtro com RLS.
 */
export interface TenantContext {
  readonly tenantId: OrganizationId
  readonly actor: Actor
}

/** Monta o contexto a partir do ator da sessão. É o único caminho de produção até um caso de uso. */
export function createTenantContext(actor: Actor): TenantContext {
  return { tenantId: actor.organizationId, actor }
}

/**
 * Barreira em tempo de execução para quem chega ao caso de uso sem passar pelo tipo (JavaScript,
 * `as`, dado de fora). Recusa o contexto ausente ou inconsistente antes de qualquer consulta.
 */
export function assertTenantContext(value: unknown): asserts value is TenantContext {
  const context = value as Partial<TenantContext> | null | undefined
  if (
    typeof context !== 'object' ||
    context === null ||
    typeof context.actor !== 'object' ||
    context.actor === null ||
    context.tenantId !== context.actor.organizationId
  )
    throw new TypeError(
      'TenantContext obrigatório: o caso de uso não roda sem o contexto da sessão',
    )
}
