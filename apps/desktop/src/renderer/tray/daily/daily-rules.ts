import type { DailyAnswersDto } from '@agilebox/contract'
import { trayCopy } from '../copy'

/** Limite de cada resposta, em caracteres (igual ao core e ao contrato). */
export const DAILY_ANSWER_LIMIT = 500

export const EMPTY_DAILY_ANSWERS: DailyAnswersDto = { progress: '', nextStep: '', blocker: '' }

/** Caracteres como o usuário os vê (conta pontos de código, não bytes). */
export function answerLength(text: string): number {
  return Array.from(text).length
}

/** Há texto em alguma resposta (espaços sozinhos não contam). */
export function hasDailyText(answers: DailyAnswersDto): boolean {
  return Object.values(answers).some((value) => value.trim() !== '')
}

/**
 * Valida o rascunho antes de salvar. Devolve a mensagem para a pessoa ou null.
 * Tarefas citadas sozinhas não bastam: é preciso texto ou "Sem novidades".
 */
export function validateDailyDraft(answers: DailyAnswersDto, noNews: boolean): string | null {
  const tooLong = Object.values(answers).some((value) => answerLength(value) > DAILY_ANSWER_LIMIT)
  if (tooLong) return trayCopy.dailyTooLong
  if (!noNews && !hasDailyText(answers)) return trayCopy.dailyEmpty
  return null
}
