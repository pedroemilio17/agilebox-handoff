export type DomainErrorCode =
  'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'DEFINITION_OF_DONE_NOT_CONFIRMED'

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

/** Item da definição de pronto que a conclusão não confirmou (id e título, para a UI mostrar). */
export interface MissingDefinitionItem {
  readonly id: string
  readonly title: string
}

export class DefinitionOfDoneNotConfirmedError extends DomainError {
  constructor(public readonly missingItems: readonly MissingDefinitionItem[]) {
    super('DEFINITION_OF_DONE_NOT_CONFIRMED', 'Confirme a definição de pronto antes de concluir')
  }
}
