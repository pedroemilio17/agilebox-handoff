export type DomainErrorCode = 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION', message)
  }
}

export class PermissionDeniedError extends DomainError {
  constructor(message: string) {
    super('FORBIDDEN', message)
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super('NOT_FOUND', message)
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message)
  }
}
