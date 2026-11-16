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

/**
 * Valor/hora do custo estimado (M3.2): o do envolvimento do Responsável; se ele não tem valor
 * (0 = não definido), o padrão do usuário. O Responsável é sempre usuário, então não há padrão de entidade.
 */
export function estimateRateCents(
  responsibleRateCents: number,
  userDefaultRateCents: number,
): number {
  validateHundredths(responsibleRateCents)
  validateHundredths(userDefaultRateCents)
  return responsibleRateCents > 0 ? responsibleRateCents : userDefaultRateCents
}

/**
 * Custo estimado = estimativa × valor/hora (`subtotal`, o mesmo arredondamento do custo realizado).
 * Sem estimativa, ou sem valor/hora, não há custo: devolve nulo.
 */
export function estimatedCost(
  estimatedHoursHundredths: number | null,
  rateCents: number,
): number | null {
  if (estimatedHoursHundredths === null || rateCents === 0) return null
  return subtotal(estimatedHoursHundredths, rateCents)
}

/** Custo estimado de uma tarefa a partir do Responsável (e do padrão dele, se o envolvimento está sem valor). */
export function estimatedCostOf(
  task: {
    readonly estimatedHoursHundredths: number | null
    readonly participations: readonly { readonly role: string; readonly rateCents: number }[]
  },
  userDefaultRateCents: number,
): number | null {
  const responsible = task.participations.find((p) => p.role === 'responsible')
  if (!responsible) return null
  return estimatedCost(
    task.estimatedHoursHundredths,
    estimateRateCents(responsible.rateCents, userDefaultRateCents),
  )
}

/** Horas realizadas da tarefa: soma das horas das participações (em centésimos). */
export function spentHundredths(
  participations: readonly { readonly hoursHundredths: number }[],
): number {
  return participations.reduce((sum, participation) => sum + participation.hoursHundredths, 0)
}
