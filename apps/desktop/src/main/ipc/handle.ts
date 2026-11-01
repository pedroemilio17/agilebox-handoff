import type { Actor } from '@agilebox/core'
import { DomainError } from '@agilebox/core'
import type { ActorSession } from '@agilebox/application'
import type { ApiResult } from '@agilebox/contract'
import { failureResult, successResult } from '@agilebox/contract'

export interface InputSchema<Input> {
  parse(value: unknown): Input
}

export type IpcHandler = (event: unknown, input: unknown) => Promise<ApiResult<unknown>>

function errorResult(error: unknown): ApiResult<never> {
  if (error instanceof DomainError) return failureResult(error.code, error.message)
  return failureResult('CONFLICT', 'Ocorreu um erro inesperado')
}

export function createIpcHandler<Input, Output>(
  schema: InputSchema<Input>,
  actorSession: ActorSession,
  execute: (actor: Actor, input: Input) => Output | Promise<Output>,
): IpcHandler {
  return async (_event, rawInput) => {
    let input: Input
    try {
      input = schema.parse(rawInput)
    } catch {
      return failureResult('VALIDATION', 'Entrada inválida')
    }
    try {
      const actor = actorSession.get()
      return successResult(await execute(actor, input))
    } catch (error) {
      return errorResult(error)
    }
  }
}
