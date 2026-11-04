export type ApiErrorCode =
  | 'VALIDATION'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DEFINITION_OF_DONE_NOT_CONFIRMED'
  | 'EXPORT_FAILED'

export type ApiMissingItem = { id: string; title: string }

export type ApiErrorPayload = {
  code: ApiErrorCode
  message: string
  /** Só em DEFINITION_OF_DONE_NOT_CONFIRMED: os itens que a conclusão não confirmou. */
  missingItems?: ApiMissingItem[]
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiErrorPayload }

export const successResult = <T>(value: T): ApiResult<T> => ({ ok: true, value })

export const failureResult = (
  code: ApiErrorCode,
  message: string,
  missingItems?: ApiMissingItem[],
): ApiResult<never> => ({
  ok: false,
  error: missingItems === undefined ? { code, message } : { code, message, missingItems },
})
