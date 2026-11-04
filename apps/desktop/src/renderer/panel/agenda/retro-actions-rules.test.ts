import { describe, expect, it } from 'vitest'
import {
  RETRO_ACTION_MESSAGES,
  isRetroActionOverdue,
  validateRetroActionDue,
  validateRetroActionTitle,
} from './retro-actions-rules'

describe('validateRetroActionTitle', () => {
  it('exige texto depois de tirar os espaços das pontas', () => {
    expect(validateRetroActionTitle('   ')).toBe('Escreva o combinado.')
    expect(validateRetroActionTitle('  Revisar fluxo  ')).toBeNull()
  })

  it('aceita até 200 caracteres e recusa 201 (contando caracteres, não bytes)', () => {
    expect(validateRetroActionTitle('a'.repeat(200))).toBeNull()
    expect(validateRetroActionTitle('a'.repeat(201))).toBe(RETRO_ACTION_MESSAGES.titleTooLong)
    expect(validateRetroActionTitle('é'.repeat(200))).toBeNull()
  })
})

describe('validateRetroActionDue', () => {
  it('aceita prazo vazio, o próprio dia da retro e dias depois', () => {
    expect(validateRetroActionDue('', '2026-11-02')).toBeNull()
    expect(validateRetroActionDue('2026-11-02', '2026-11-02')).toBeNull()
    expect(validateRetroActionDue('2026-11-09', '2026-11-02')).toBeNull()
  })

  it('recusa prazo anterior à retro', () => {
    expect(validateRetroActionDue('2026-11-01', '2026-11-02')).toBe(
      'O prazo não pode ser antes da retro.',
    )
  })
})

describe('isRetroActionOverdue', () => {
  it('é vencido só com prazo passado e sem feito', () => {
    expect(isRetroActionOverdue({ dueDate: '2026-10-30', done: false }, '2026-11-01')).toBe(true)
    expect(isRetroActionOverdue({ dueDate: '2026-10-30', done: true }, '2026-11-01')).toBe(false)
    expect(isRetroActionOverdue({ dueDate: null, done: false }, '2026-11-01')).toBe(false)
    expect(isRetroActionOverdue({ dueDate: '2026-11-01', done: false }, '2026-11-01')).toBe(false)
  })
})
