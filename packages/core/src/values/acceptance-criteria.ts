import { NotFoundError, ValidationError } from '../shared/errors'

/**
 * Critérios de aceite de uma tarefa (M3.2). Valor puro: a lista inteira é passada e devolvida,
 * sem mutar nada. A ordem é a ordem do array (posição 1 é o primeiro item). Não há campo de
 * posição, para não ter duas fontes de verdade; a persistência (M3.9) grava a ordem como precisar.
 *
 * Nível Avançado (B5 A) e módulo `acceptance` ligado são decisões da camada de cima. Aqui só
 * valem as regras do critério.
 */

/** Limite de caracteres do texto (pontos de código, após o trim). Decisão de M3.2, não está no plano. */
export const ACCEPTANCE_TEXT_MAX_LENGTH = 200

declare const acceptanceCriterionIdBrand: unique symbol
export type AcceptanceCriterionId = string & {
  readonly [acceptanceCriterionIdBrand]: 'AcceptanceCriterion'
}

export interface AcceptanceCriterion {
  readonly id: AcceptanceCriterionId
  readonly text: string
  readonly done: boolean
}

export interface AcceptanceCriterionInput {
  readonly id: string
  readonly text: string
}

export interface AcceptanceSummary {
  readonly done: number
  readonly total: number
  /** Verdadeiro só com pelo menos um critério e todos conferidos. Lista vazia não é "tudo conferido". */
  readonly allDone: boolean
}

/** Mesmo formato de identificador de `shared/ids.ts` (ULID de 26 caracteres). */
export function toAcceptanceCriterionId(value: string): AcceptanceCriterionId {
  if (typeof value !== 'string' || !/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(value)) {
    throw new ValidationError('Identificador de critério inválido')
  }
  return value as AcceptanceCriterionId
}

/** Só espaços, quebras de linha, controles e caracteres de formatação invisíveis (ex.: U+200B, U+FEFF). */
const INVISIBLE_ONLY = /^[\s\p{Cc}\p{Cf}]*$/u

/**
 * Texto obrigatório: sem vazio, sem só caracteres invisíveis, e com no máximo
 * `ACCEPTANCE_TEXT_MAX_LENGTH`.
 */
export function parseAcceptanceText(value: string): string {
  if (typeof value !== 'string') throw new ValidationError('Critério inválido')
  const text = value.trim()
  if (!text || INVISIBLE_ONLY.test(text)) throw new ValidationError('Critério obrigatório')
  if (Array.from(text).length > ACCEPTANCE_TEXT_MAX_LENGTH) {
    throw new ValidationError(
      `Critério deve ter no máximo ${ACCEPTANCE_TEXT_MAX_LENGTH} caracteres`,
    )
  }
  return text
}

function assertBoolean(value: boolean): void {
  if (typeof value !== 'boolean') throw new ValidationError('Situação do critério inválida')
}

/** Recusa uma lista de entrada com identificador repetido: a posição de um critério ficaria ambígua. */
function assertUniqueIds(criteria: readonly AcceptanceCriterion[]): void {
  if (new Set(criteria.map((criterion) => criterion.id)).size !== criteria.length) {
    throw new ValidationError('Critério duplicado na lista')
  }
}

function indexOfCriterion(
  criteria: readonly AcceptanceCriterion[],
  id: AcceptanceCriterionId,
): number {
  const index = criteria.findIndex((criterion) => criterion.id === id)
  if (index < 0) throw new NotFoundError('Critério não encontrado')
  return index
}

/** Acrescenta um critério no fim, não conferido. Recusa id repetido na mesma lista. */
export function addCriterion(
  criteria: readonly AcceptanceCriterion[],
  input: AcceptanceCriterionInput,
): AcceptanceCriterion[] {
  const id = toAcceptanceCriterionId(input.id)
  const text = parseAcceptanceText(input.text)
  if (criteria.some((criterion) => criterion.id === id)) {
    throw new ValidationError('Critério duplicado')
  }
  return [...criteria, { id, text, done: false }]
}

/** Troca o texto de um critério. Não muda a situação (feito ou não). */
export function editCriterionText(
  criteria: readonly AcceptanceCriterion[],
  id: AcceptanceCriterionId,
  value: string,
): AcceptanceCriterion[] {
  assertUniqueIds(criteria)
  const index = indexOfCriterion(criteria, id)
  const text = parseAcceptanceText(value)
  return criteria.map((criterion, i) => (i === index ? { ...criterion, text } : criterion))
}

/** Marca ou desmarca um critério. Explícito (não alterna) para ser idempotente. */
export function setCriterionDone(
  criteria: readonly AcceptanceCriterion[],
  id: AcceptanceCriterionId,
  done: boolean,
): AcceptanceCriterion[] {
  assertUniqueIds(criteria)
  const index = indexOfCriterion(criteria, id)
  assertBoolean(done)
  return criteria.map((criterion, i) => (i === index ? { ...criterion, done } : criterion))
}

/** Remove um critério. Os demais mantêm a ordem relativa. */
export function removeCriterion(
  criteria: readonly AcceptanceCriterion[],
  id: AcceptanceCriterionId,
): AcceptanceCriterion[] {
  assertUniqueIds(criteria)
  const index = indexOfCriterion(criteria, id)
  return criteria.filter((_, i) => i !== index)
}

/**
 * Move um critério para a posição `toIndex` (0-based, dentro de 0..n-1). Os demais se acomodam.
 * Mover para a própria posição devolve uma cópia igual.
 */
export function reorderCriterion(
  criteria: readonly AcceptanceCriterion[],
  id: AcceptanceCriterionId,
  toIndex: number,
): AcceptanceCriterion[] {
  assertUniqueIds(criteria)
  const from = indexOfCriterion(criteria, id)
  if (!Number.isSafeInteger(toIndex) || toIndex < 0 || toIndex > criteria.length - 1) {
    throw new ValidationError('Posição do critério fora da lista')
  }
  const reordered = [...criteria]
  const [moved] = reordered.splice(from, 1)
  if (moved === undefined) throw new NotFoundError('Critério não encontrado')
  reordered.splice(toIndex, 0, moved)
  return reordered
}

/**
 * Contagem n/m para a interface (ex.: "2/3"). Não bloqueia nada: quem decide o efeito de
 * "conferido ao concluir" (Q5) usa `allDone`.
 */
export function acceptanceSummary(criteria: readonly AcceptanceCriterion[]): AcceptanceSummary {
  const done = criteria.filter((criterion) => criterion.done).length
  const total = criteria.length
  return { done, total, allDone: total > 0 && done === total }
}
