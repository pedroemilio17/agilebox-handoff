import type { Participation } from '../entities/participation'
import type { Task } from '../entities/task'
import { canSeeRate, canSeeTaskTotal } from '../policies/access-policy'
import type { Actor } from '../policies/actor'
import { ValidationError } from '../shared/errors'
import { validateHundredths } from '../values/decimal'
import { assertEstimatedHours } from '../values/hours'
import { sumMoney } from '../values/money'
import { total as realizedTotal } from './cost'

/**
 * Custo estimado e realizado, com visibilidade (ADR-07, M3.3).
 *
 * Regra do custo estimado (Q2, recomendação adotada, pendente de confirmação do Pedro): a estimativa
 * é dividida em partes iguais entre TODOS os envolvidos da tarefa, com ou sem horas realizadas. Cada
 * parcela usa o valor/hora da própria pessoa. Assim o custo estimado só muda quando muda a estimativa
 * ou a lista de envolvidos; lançar horas não altera nada. Arredondamento: uma vez por parcela, meio
 * para cima, em centavos. Por isso a soma das parcelas pode diferir de estimativa × taxa em até n/2
 * centavos (n = envolvidos). ADR 0005.
 *
 * Visibilidade: quem não pode ver um valor nunca recebe o cálculo. Gestor vê o total; colaborador vê
 * só a própria parcela (ou a própria parte realizada). Quem não participa, ou outra organização, recebe
 * nulo. O cálculo de uma parcela só lê o valor/hora de quem a recebe.
 */

function canSeeParticipation(actor: Actor, task: Task, participation: Participation): boolean {
  return canSeeRate(actor, {
    organizationId: task.organizationId,
    participant: participation.participant,
  })
}

/**
 * Parcela da estimativa de uma pessoa, em centavos: `estimatedHours / people * rateCents / 100`.
 * Função pura, sem visibilidade: quem chama decide quem pode vê-la.
 */
export function plannedShareCents(
  estimatedHours: number,
  people: number,
  rateCents: number,
): number {
  const hours = assertEstimatedHours(estimatedHours)
  if (!Number.isSafeInteger(people) || people < 1)
    throw new ValidationError('Número de envolvidos inválido')
  validateHundredths(rateCents)
  const denominator = 100n * BigInt(people)
  const rounded = (BigInt(hours) * BigInt(rateCents) + denominator / 2n) / denominator
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new ValidationError('Valor inválido')
  return Number(rounded)
}

/**
 * Custo estimado que o ator pode ver, em centavos. Nulo quando não há estimativa, quando o ator
 * não participa ou é de outra organização. Gestor: total da tarefa. Colaborador: a própria parcela.
 */
export function visiblePlannedCost(actor: Actor, task: Task): number | null {
  const estimate = task.estimatedHours
  if (estimate === null || actor.organizationId !== task.organizationId) return null
  const people = task.participations
  if (people.length === 0) return null
  const shareOf = (participation: Participation): number =>
    plannedShareCents(estimate, people.length, participation.rateCents)

  if (canSeeTaskTotal(actor, task.organizationId)) {
    return people.reduce((sum, participation) => sumMoney(sum, shareOf(participation)), 0)
  }
  const own = people.find((p) => canSeeParticipation(actor, task, p))
  return own === undefined ? null : shareOf(own)
}

/**
 * Custo realizado (horas por participação, como hoje) que o ator pode ver, em centavos.
 * Gestor: total da tarefa. Colaborador: a própria parte. Nulo se não participa.
 */
export function visibleRealizedCost(actor: Actor, task: Task): number | null {
  if (canSeeTaskTotal(actor, task.organizationId)) return realizedTotal(task.participations)
  const own = task.participations.filter((p) => canSeeParticipation(actor, task, p))
  return own.length === 0 ? null : realizedTotal(own)
}
