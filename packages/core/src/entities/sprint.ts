import { ValidationError } from '../shared/errors'
import type { OrganizationId, ProjectId, SprintId, UserId } from '../shared/ids'
import { compareDateOnly, parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'

export const SPRINT_STATUSES = ['draft', 'active', 'closed'] as const
export type SprintStatus = (typeof SPRINT_STATUSES)[number]

/** Rótulos da interface (pt-BR). "Rascunho" evita confusão com o estado Planejamento da tarefa. */
export const SPRINT_STATUS_LABELS: Readonly<Record<SprintStatus, string>> = {
  draft: 'Rascunho',
  active: 'Ativa',
  closed: 'Encerrada',
}

export const SPRINT_NAME_MAX_LENGTH = 80
export const SPRINT_GOAL_MAX_LENGTH = 280

/**
 * Política de encerramento para os itens abertos (M4.1). `return_to_backlog` é o padrão.
 * `carry_over` leva os itens abertos para uma sprint em rascunho do mesmo projeto.
 */
export type SprintClosePolicy =
  | { readonly kind: 'return_to_backlog' }
  | { readonly kind: 'carry_over'; readonly nextSprintId: SprintId }

export interface Sprint {
  readonly id: SprintId
  readonly organizationId: OrganizationId
  readonly projectId: ProjectId
  /** Sequencial por projeto: "Sprint 4" é o número 4. */
  readonly number: number
  readonly name: string
  /** Meta opcional. Nulo = sem meta. */
  readonly goal: string | null
  /** Datas de calendário planejadas, início ≤ fim. */
  readonly plannedStart: DateOnly
  readonly plannedEnd: DateOnly
  readonly status: SprintStatus
  /** Instante em que a sprint foi iniciada. Nulo enquanto estiver em rascunho. */
  readonly startedAt: string | null
  /** Instante do encerramento. Nulo até encerrar. */
  readonly closedAt: string | null
  /** Política usada no encerramento. Nula até encerrar. */
  readonly closePolicy: SprintClosePolicy | null
  readonly createdBy: UserId
  readonly createdAt: string
}

/** Rótulo do card e da linha do tempo: "Sprint 4". */
export function sprintLabel(number: number): string {
  return `Sprint ${number}`
}

export function validateSprintNumber(number: number): number {
  if (!Number.isSafeInteger(number) || number < 1)
    throw new ValidationError('Número da sprint inválido')
  return number
}

/** Nome vazio vira "Sprint N". Mais de 80 caracteres é recusado. */
export function validateSprintName(name: string, number: number): string {
  const trimmed = name.trim()
  if (!trimmed) return sprintLabel(number)
  if (Array.from(trimmed).length > SPRINT_NAME_MAX_LENGTH)
    throw new ValidationError('Nome da sprint deve ter até 80 caracteres')
  return trimmed
}

/** Meta vazia vira nulo. Mais de 280 caracteres é recusado. */
export function validateSprintGoal(goal: string | null): string | null {
  const trimmed = goal?.trim() ?? ''
  if (!trimmed) return null
  if (Array.from(trimmed).length > SPRINT_GOAL_MAX_LENGTH)
    throw new ValidationError('Meta da sprint deve ter até 280 caracteres')
  return trimmed
}

/** Datas planejadas: ambas são datas de calendário válidas e o início não é depois do fim. */
export function validateSprintDates(
  plannedStart: string,
  plannedEnd: string,
): { plannedStart: DateOnly; plannedEnd: DateOnly } {
  const start = parseDateOnly(plannedStart)
  const end = parseDateOnly(plannedEnd)
  if (compareDateOnly(start, end) > 0)
    throw new ValidationError('A data de início não pode ser depois da data de fim')
  return { plannedStart: start, plannedEnd: end }
}

export interface CreateSprintInput {
  readonly id: SprintId
  readonly organizationId: OrganizationId
  readonly projectId: ProjectId
  readonly number: number
  readonly name: string
  readonly goal: string | null
  readonly plannedStart: string
  readonly plannedEnd: string
  readonly createdBy: UserId
  readonly createdAt: string
}

/** Cria a sprint em rascunho. O número é atribuído pela aplicação (ver `nextSprintNumber`). */
export function createSprint(input: CreateSprintInput): Sprint {
  const number = validateSprintNumber(input.number)
  const dates = validateSprintDates(input.plannedStart, input.plannedEnd)
  return {
    id: input.id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    number,
    name: validateSprintName(input.name, number),
    goal: validateSprintGoal(input.goal),
    plannedStart: dates.plannedStart,
    plannedEnd: dates.plannedEnd,
    status: 'draft',
    startedAt: null,
    closedAt: null,
    closePolicy: null,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  }
}
