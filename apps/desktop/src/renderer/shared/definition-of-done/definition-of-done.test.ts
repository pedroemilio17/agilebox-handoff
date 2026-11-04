import { describe, expect, it } from 'vitest'
import { ApiError } from '@agilebox/contract'
import {
  definitionLimitReached,
  definitionTitleError,
  isDefinitionOfDoneNotConfirmed,
} from './definition-of-done'

describe('isDefinitionOfDoneNotConfirmed', () => {
  it('reconhece só o erro tipado da conclusão sem confirmação', () => {
    expect(
      isDefinitionOfDoneNotConfirmed(
        new ApiError('DEFINITION_OF_DONE_NOT_CONFIRMED', 'Confirme', [{ id: 'a', title: 'x' }]),
      ),
    ).toBe(true)
    expect(isDefinitionOfDoneNotConfirmed(new ApiError('FORBIDDEN', 'Não'))).toBe(false)
    expect(isDefinitionOfDoneNotConfirmed(new Error('boom'))).toBe(false)
  })
})

describe('definitionTitleError', () => {
  it('exige ao menos um caractere depois de aparar espaços', () => {
    expect(definitionTitleError('   ')).toBe('Escreva um título para o item.')
  })

  it('aceita 200 caracteres e recusa 201', () => {
    expect(definitionTitleError('a'.repeat(200))).toBeNull()
    expect(definitionTitleError('a'.repeat(201))).toBe('Use até 200 caracteres.')
  })

  it('conta caracteres, não bytes', () => {
    expect(definitionTitleError('ç'.repeat(200))).toBeNull()
  })
})

describe('definitionLimitReached', () => {
  it('chega ao limite em 20 itens', () => {
    expect(definitionLimitReached(19)).toBe(false)
    expect(definitionLimitReached(20)).toBe(true)
  })
})
