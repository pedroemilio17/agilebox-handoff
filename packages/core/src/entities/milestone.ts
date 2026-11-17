import { ValidationError } from '../shared/errors'
import type { DeliverableId, MilestoneId, OrganizationId, ProjectId, UserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'

/** Marco do projeto (ADR-10): um prazo com nome, opcionalmente ligado a uma entrega e a um critério. */
export const MILESTONE_TITLE_MAX_LENGTH = 200
export const MILESTONE_CRITERION_MAX_LENGTH = 280

export interface Milestone {
  readonly id: MilestoneId
  readonly organizationId: OrganizationId
  readonly projectId: ProjectId
  readonly title: string
  /** Data-alvo do marco (calendário, sem hora). */
  readonly dueOn: DateOnly
  /** Entrega ligada ao marco (qualquer nível da EAP do mesmo projeto). Nulo = sem vínculo. */
  readonly deliverableId: DeliverableId | null
  /** Critério de conclusão do marco. Nulo = sem critério. */
  readonly criterion: string | null
  readonly createdBy: UserId
  readonly createdAt: string
}

export interface CreateMilestoneInput {
  readonly id: MilestoneId
  readonly organizationId: OrganizationId
  readonly projectId: ProjectId
  readonly title: string
  readonly dueOn: string
  readonly deliverableId: DeliverableId | null
  readonly criterion: string | null
  readonly createdBy: UserId
  readonly createdAt: string
}

/** Campos editáveis do marco. Ausente = não muda. */
export interface MilestoneUpdate {
  readonly title?: string
  readonly dueOn?: string
  readonly deliverableId?: DeliverableId | null
  readonly criterion?: string | null
}

export function validateMilestoneTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) throw new ValidationError('Título do marco obrigatório')
  if (Array.from(trimmed).length > MILESTONE_TITLE_MAX_LENGTH)
    throw new ValidationError('Título do marco deve ter até 200 caracteres')
  return trimmed
}

/** Critério vazio vira nulo. Mais de 280 caracteres é recusado. */
export function validateMilestoneCriterion(criterion: string | null): string | null {
  const trimmed = criterion?.trim() ?? ''
  if (!trimmed) return null
  if (Array.from(trimmed).length > MILESTONE_CRITERION_MAX_LENGTH)
    throw new ValidationError('Critério do marco deve ter até 280 caracteres')
  return trimmed
}

export function createMilestone(input: CreateMilestoneInput): Milestone {
  return {
    id: input.id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    title: validateMilestoneTitle(input.title),
    dueOn: parseDateOnly(input.dueOn),
    deliverableId: input.deliverableId,
    criterion: validateMilestoneCriterion(input.criterion),
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  }
}

export function updateMilestone(milestone: Milestone, update: MilestoneUpdate): Milestone {
  return {
    ...milestone,
    title: update.title === undefined ? milestone.title : validateMilestoneTitle(update.title),
    dueOn: update.dueOn === undefined ? milestone.dueOn : parseDateOnly(update.dueOn),
    deliverableId:
      update.deliverableId === undefined ? milestone.deliverableId : update.deliverableId,
    criterion:
      update.criterion === undefined
        ? milestone.criterion
        : validateMilestoneCriterion(update.criterion),
  }
}
