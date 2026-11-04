import {
  ApiError,
  DEFINITION_OF_DONE_MAX_ITEMS,
  DEFINITION_OF_DONE_TITLE_MAX_LENGTH,
} from '@agilebox/contract'

/** Conclusão recusada pelo servidor porque a definição de pronto não foi toda confirmada. */
export function isDefinitionOfDoneNotConfirmed(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === 'DEFINITION_OF_DONE_NOT_CONFIRMED'
}

/** Mensagem de validação de um título de item (1 a 200 caracteres, sem contar espaços das bordas). */
export function definitionTitleError(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return 'Escreva um título para o item.'
  if (Array.from(trimmed).length > DEFINITION_OF_DONE_TITLE_MAX_LENGTH)
    return `Use até ${DEFINITION_OF_DONE_TITLE_MAX_LENGTH} caracteres.`
  return null
}

export function definitionLimitReached(count: number): boolean {
  return count >= DEFINITION_OF_DONE_MAX_ITEMS
}
