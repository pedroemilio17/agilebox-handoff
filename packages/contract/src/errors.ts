import type { ApiErrorCode } from './result'

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message)
    this.name = new.target.name
  }
}
