import type { ApiErrorCode } from './result'

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    /** Só na conclusão sem confirmação: itens que faltaram (a UI abre a conferência com eles). */
    public readonly missingItems: readonly { id: string; title: string }[] = [],
  ) {
    super(message)
    this.name = new.target.name
  }
}
