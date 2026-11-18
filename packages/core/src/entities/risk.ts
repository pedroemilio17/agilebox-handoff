import { ValidationError } from '../shared/errors'
import type { DeliverableId, OrganizationId, ProjectId, RiskId, UserId } from '../shared/ids'

/** Risco do projeto (ADR-10, módulo `risks`). Campos de texto têm limite; probabilidade e impacto são 1 a 3. */
export const RISK_TITLE_MAX_LENGTH = 200
export const RISK_DESCRIPTION_MAX_LENGTH = 1000
export const RISK_RESPONSE_MAX_LENGTH = 280

/** Escala de probabilidade e de impacto: 1 baixa, 2 média, 3 alta. */
export const RISK_LEVELS = [1, 2, 3] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

/** Estados do risco: aberto, mitigado (a resposta foi feita), ocorreu (virou problema) ou encerrado. */
export const RISK_STATUSES = ['open', 'mitigated', 'occurred', 'closed'] as const
export type RiskStatus = (typeof RISK_STATUSES)[number]

export interface Risk {
  readonly id: RiskId
  readonly organizationId: OrganizationId
  readonly projectId: ProjectId
  readonly title: string
  /** Nulo = sem descrição. */
  readonly description: string | null
  readonly probability: RiskLevel
  readonly impact: RiskLevel
  /** Resposta planejada, em texto curto. Nulo = ainda não definida. */
  readonly response: string | null
  /** Dono do risco: precisa ser membro do projeto. Nulo = sem dono. */
  readonly ownerId: UserId | null
  /** Entrega ligada (risco por entrega, só com a EAP ligada). Nulo = risco do projeto inteiro. */
  readonly deliverableId: DeliverableId | null
  readonly status: RiskStatus
  readonly createdBy: UserId
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateRiskInput {
  readonly id: RiskId
  readonly organizationId: OrganizationId
  readonly projectId: ProjectId
  readonly title: string
  readonly description: string | null
  readonly probability: number
  readonly impact: number
  readonly response: string | null
  readonly ownerId: UserId | null
  readonly deliverableId: DeliverableId | null
  /** Ausente = aberto. */
  readonly status?: RiskStatus
  readonly createdBy: UserId
  readonly createdAt: string
}

/** Campos editáveis do risco. Ausente = não muda; nulo nos campos opcionais desliga o valor. */
export interface RiskUpdate {
  readonly title?: string
  readonly description?: string | null
  readonly probability?: number
  readonly impact?: number
  readonly response?: string | null
  readonly ownerId?: UserId | null
  readonly deliverableId?: DeliverableId | null
  readonly status?: RiskStatus
}

export function validateRiskTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) throw new ValidationError('Título do risco obrigatório')
  if (Array.from(trimmed).length > RISK_TITLE_MAX_LENGTH)
    throw new ValidationError('Título do risco deve ter até 200 caracteres')
  return trimmed
}

/** Texto vazio vira nulo. Acima do limite é recusado. */
export function validateRiskText(
  value: string | null,
  maxLength: number,
  label: string,
): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null
  if (Array.from(trimmed).length > maxLength)
    throw new ValidationError(`${label} deve ter até ${maxLength} caracteres`)
  return trimmed
}

export function validateRiskDescription(description: string | null): string | null {
  return validateRiskText(description, RISK_DESCRIPTION_MAX_LENGTH, 'Descrição do risco')
}

export function validateRiskResponse(response: string | null): string | null {
  return validateRiskText(response, RISK_RESPONSE_MAX_LENGTH, 'Resposta do risco')
}

/** Probabilidade ou impacto: só 1, 2 ou 3. */
export function parseRiskLevel(value: number, label: string): RiskLevel {
  const level = RISK_LEVELS.find((item) => item === value)
  if (level === undefined) throw new ValidationError(`${label} deve ser baixa, média ou alta`)
  return level
}

export function parseRiskStatus(value: string): RiskStatus {
  const status = RISK_STATUSES.find((item) => item === value)
  if (status === undefined) throw new ValidationError('Situação do risco inválida')
  return status
}

export function createRisk(input: CreateRiskInput): Risk {
  return {
    id: input.id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    title: validateRiskTitle(input.title),
    description: validateRiskDescription(input.description),
    probability: parseRiskLevel(input.probability, 'Probabilidade'),
    impact: parseRiskLevel(input.impact, 'Impacto'),
    response: validateRiskResponse(input.response),
    ownerId: input.ownerId,
    deliverableId: input.deliverableId,
    status: input.status ?? 'open',
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  }
}

/** Aplica a edição e carimba `updatedAt`. Campo ausente não muda. */
export function updateRisk(risk: Risk, update: RiskUpdate, updatedAt: string): Risk {
  return {
    ...risk,
    title: update.title === undefined ? risk.title : validateRiskTitle(update.title),
    description:
      update.description === undefined
        ? risk.description
        : validateRiskDescription(update.description),
    probability:
      update.probability === undefined
        ? risk.probability
        : parseRiskLevel(update.probability, 'Probabilidade'),
    impact: update.impact === undefined ? risk.impact : parseRiskLevel(update.impact, 'Impacto'),
    response: update.response === undefined ? risk.response : validateRiskResponse(update.response),
    ownerId: update.ownerId === undefined ? risk.ownerId : update.ownerId,
    deliverableId: update.deliverableId === undefined ? risk.deliverableId : update.deliverableId,
    status: update.status === undefined ? risk.status : parseRiskStatus(update.status),
    updatedAt,
  }
}
