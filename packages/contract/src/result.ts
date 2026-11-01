export type ApiErrorCode = 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'

export type ApiErrorPayload = {
  code: ApiErrorCode
  message: string
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiErrorPayload }

export const successResult = <T>(value: T): ApiResult<T> => ({ ok: true, value })

export const failureResult = (code: ApiErrorCode, message: string): ApiResult<never> => ({
  ok: false,
  error: { code, message },
})
