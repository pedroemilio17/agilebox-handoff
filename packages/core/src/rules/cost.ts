import { ValidationError } from '../shared/errors'
import { validateHundredths } from '../values/decimal'
import { sumMoney } from '../values/money'

export function subtotal(hoursHundredths: number, rateCents: number): number {
  validateHundredths(hoursHundredths)
  validateHundredths(rateCents)
  const rounded = (BigInt(hoursHundredths) * BigInt(rateCents) + 50n) / 100n
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new ValidationError('Valor inválido')
  return Number(rounded)
}

export function total(
  participations: readonly { hoursHundredths: number; rateCents: number }[],
): number {
  return sumMoney(
    ...participations.map(({ hoursHundredths, rateCents }) => subtotal(hoursHundredths, rateCents)),
  )
}
