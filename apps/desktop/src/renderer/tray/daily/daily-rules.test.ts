import { describe, expect, it } from 'vitest'
import {
  DAILY_ANSWER_LIMIT,
  EMPTY_DAILY_ANSWERS,
  answerLength,
  hasDailyText,
  validateDailyDraft,
} from './daily-rules'

describe('regras da daily na bandeja', () => {
  it('conta caracteres como a pessoa vê, inclusive acentos e emoji', () => {
    expect(answerLength('ção')).toBe(3)
    expect(answerLength('😀😀')).toBe(2)
    expect(DAILY_ANSWER_LIMIT).toBe(500)
  })

  it('espaços sozinhos não contam como texto', () => {
    expect(hasDailyText({ ...EMPTY_DAILY_ANSWERS, progress: '   ' })).toBe(false)
    expect(hasDailyText({ ...EMPTY_DAILY_ANSWERS, blocker: 'x' })).toBe(true)
  })

  it('exige texto ou Sem novidades', () => {
    expect(validateDailyDraft(EMPTY_DAILY_ANSWERS, false)).toBe(
      'Escreva ao menos uma resposta ou marque Sem novidades.',
    )
    expect(validateDailyDraft(EMPTY_DAILY_ANSWERS, true)).toBeNull()
    expect(validateDailyDraft({ ...EMPTY_DAILY_ANSWERS, nextStep: 'Ok' }, false)).toBeNull()
  })

  it('bloqueia resposta com mais de 500 caracteres, e 500 passa', () => {
    const ok = { ...EMPTY_DAILY_ANSWERS, progress: 'a'.repeat(500) }
    const tooLong = { ...EMPTY_DAILY_ANSWERS, progress: 'a'.repeat(501) }
    expect(validateDailyDraft(ok, false)).toBeNull()
    expect(validateDailyDraft(tooLong, false)).toBe(
      'Esta resposta passa de 500 caracteres. Reduza o texto para continuar.',
    )
  })
})
