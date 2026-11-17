import { DefinitionOfDoneNotConfirmedError, DomainError } from '@agilebox/core'
import type { ActorSession, TenantContext } from '@agilebox/application'
import { createTenantContext } from '@agilebox/application'
import type { ApiResult } from '@agilebox/contract'
import { failureResult, successResult } from '@agilebox/contract'

export interface InputSchema<Input> {
  parse(value: unknown): Input
}

export type IpcHandler = (event: unknown, input: unknown) => Promise<ApiResult<unknown>>

function errorResult(error: unknown): ApiResult<never> {
  // A conclusão sem confirmação leva os itens que faltaram, para a UI abrir a conferência.
  if (error instanceof DefinitionOfDoneNotConfirmedError)
    return failureResult(error.code, error.message, [...error.missingItems])
  if (error instanceof DomainError) return failureResult(error.code, error.message)
  return failureResult('CONFLICT', 'Ocorreu um erro inesperado')
}

export function createIpcHandler<Input, Output>(
  schema: InputSchema<Input>,
  actorSession: ActorSession,
  execute: (context: TenantContext, input: Input) => Output | Promise<Output>,
): IpcHandler {
  return async (_event, rawInput) => {
    let input: Input
    try {
      input = schema.parse(rawInput)
    } catch {
      return failureResult('VALIDATION', 'Entrada inválida')
    }
    try {
      // O contexto vem só da sessão. Campos extras do pedido (`userId`, `tenantId`) não chegam ao
      // caso de uso: o schema os descarta ou recusa antes.
      const context = createTenantContext(actorSession.get())
      return successResult(await execute(context, input))
    } catch (error) {
      return errorResult(error)
    }
  }
}
