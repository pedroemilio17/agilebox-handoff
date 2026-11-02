import { ValidationError } from '../shared/errors'
import { parseHundredths, validateHundredths } from './decimal'

export function parseHours(value: string): number {
  return parseHundredths(value)
}

export function formatHours(hundredths: number): string {
  validateHundredths(hundredths)
  const fraction = String(hundredths % 100)
    .padStart(2, '0')
    .replace(/0+$/, '')
  return `${Math.floor(hundredths / 100)}${fraction ? `,${fraction}` : ''} h`
}

/** Teto da estimativa por tarefa: 1000 h (100000 centésimos). Acima disso quase sempre é erro de digitação. */
export const MAX_ESTIMATED_HOURS = 100_000

/**
 * Valida uma estimativa em horas da tarefa (ADR-07), em centésimos de hora, a mesma unidade de
 * `hoursHundredths`. Regras: inteiro seguro, zero ou mais, até `MAX_ESTIMATED_HOURS`. O passo é
 * de 0,01 h; a entrada digitada passa antes por `parseHours`, que arredonda no terceiro decimal
 * (meio para cima). Não arredonda valor já numérico: fracionado é recusado.
 */
export function assertEstimatedHours(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new ValidationError('Estimativa inválida')
  if (value > MAX_ESTIMATED_HOURS) throw new ValidationError('Estimativa acima do limite de 1000 h')
  // -0 passa nas checagens acima; devolve +0 para não vazar para o banco ou para a comparação de igualdade.
  return value === 0 ? 0 : value
}

/** Estimativa opcional: nulo significa "sem estimativa"; zero é uma estimativa válida. */
export function parseEstimatedHours(value: number | null): number | null {
  return value === null ? null : assertEstimatedHours(value)
}
