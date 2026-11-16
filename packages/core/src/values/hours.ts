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

/** Teto de uma estimativa em horas (M3.2): acima disso é erro de digitação. */
export const ESTIMATE_MAX_HOURS = 9999

/**
 * Estimativa em horas (número com até 2 casas) para centésimos, o mesmo formato de `hours_hundredths`.
 * `null` = sem estimativa. Rejeita negativo, acima do teto e casas decimais além de duas.
 */
export function estimateToHundredths(hours: number | null): number | null {
  if (hours === null) return null
  if (!Number.isFinite(hours) || hours < 0 || hours > ESTIMATE_MAX_HOURS)
    throw new ValidationError(`Estimativa deve ser de 0 a ${ESTIMATE_MAX_HOURS} horas`)
  const hundredths = Math.round(hours * 100)
  if (Math.abs(hundredths - hours * 100) > 1e-6)
    throw new ValidationError('Estimativa aceita até 2 casas decimais')
  return hundredths
}

/** Centésimos de uma estimativa para o número de horas exibido (null continua null). */
export function hundredthsToHours(hundredths: number | null): number | null {
  return hundredths === null ? null : hundredths / 100
}
