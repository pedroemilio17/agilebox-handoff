import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  DomainError,
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
} from './errors'

describe('erros de domínio', () => {
  it.each(['VALIDATION', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT'] as const)(
    'cria DomainError com o código %s e preserva a mensagem',
    (code) => {
      const error = new DomainError(code, 'Operação inválida')

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('DomainError')
      expect(error.code).toBe(code)
      expect(error.message).toBe('Operação inválida')
    },
  )

  it.each([
    [ValidationError, 'VALIDATION'],
    [PermissionDeniedError, 'FORBIDDEN'],
    [NotFoundError, 'NOT_FOUND'],
    [ConflictError, 'CONFLICT'],
  ] as const)('cria %s com seu código específico', (ErrorType, code) => {
    const error = new ErrorType('Não foi possível concluir a operação')

    expect(error).toBeInstanceOf(ErrorType)
    expect(error).toBeInstanceOf(DomainError)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe(ErrorType.name)
    expect(error.code).toBe(code)
    expect(error.message).toBe('Não foi possível concluir a operação')
  })
})
