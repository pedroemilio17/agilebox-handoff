import { ConflictError, ValidationError } from '../shared/errors'
import type { ImpedimentId, OrganizationId, TaskId, UserId } from '../shared/ids'
import { validateBlockReason } from './validation'

/**
 * Impedimento (M5.2a): o bloqueio promovido a registro próprio, com estado e responsável por resolver.
 * Uma tarefa pode ter vários ao longo do tempo (o histórico nunca some), e no máximo um aberto.
 * A marca `blockedReason`/`blockedAt` da tarefa segue o impedimento aberto (ver rules/impediments).
 */
export const IMPEDIMENT_STATUSES = ['open', 'resolved'] as const
export type ImpedimentStatus = (typeof IMPEDIMENT_STATUSES)[number]

export const IMPEDIMENT_RESOLUTION_MAX_LENGTH = 280

export interface Impediment {
  readonly id: ImpedimentId
  readonly organizationId: OrganizationId
  readonly taskId: TaskId
  /** Motivo do bloqueio (mesmo limite de 280 caracteres do bloqueio atual). */
  readonly reason: string
  readonly status: ImpedimentStatus
  /** Usuário responsável por resolver. Nulo = sem responsável. */
  readonly ownerId: UserId | null
  readonly openedBy: UserId
  readonly openedAt: string
  readonly resolvedBy: UserId | null
  readonly resolvedAt: string | null
  /** Nota opcional de resolução (até 280 caracteres). */
  readonly resolution: string | null
}

export interface OpenImpedimentInput {
  readonly id: ImpedimentId
  readonly organizationId: OrganizationId
  readonly taskId: TaskId
  readonly reason: string
  readonly ownerId: UserId | null
  readonly openedBy: UserId
  readonly openedAt: string
}

export function openImpediment(input: OpenImpedimentInput): Impediment {
  return {
    id: input.id,
    organizationId: input.organizationId,
    taskId: input.taskId,
    reason: validateBlockReason(input.reason),
    status: 'open',
    ownerId: input.ownerId,
    openedBy: input.openedBy,
    openedAt: input.openedAt,
    resolvedBy: null,
    resolvedAt: null,
    resolution: null,
  }
}

/** Nota vazia vira nula; nota com mais de 280 caracteres é recusada. */
export function validateImpedimentResolution(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (Array.from(trimmed).length > IMPEDIMENT_RESOLUTION_MAX_LENGTH)
    throw new ValidationError('Nota de resolução deve ter até 280 caracteres')
  return trimmed
}

export function resolveImpediment(
  impediment: Impediment,
  by: UserId,
  at: string,
  resolution: string | null,
): Impediment {
  if (impediment.status === 'resolved') throw new ConflictError('Impedimento já foi resolvido')
  return {
    ...impediment,
    status: 'resolved',
    resolvedBy: by,
    resolvedAt: at,
    resolution: validateImpedimentResolution(resolution),
  }
}

/** Troca ou limpa o responsável. Igual ao atual devolve o mesmo impedimento. */
export function assignImpediment(impediment: Impediment, ownerId: UserId | null): Impediment {
  if (impediment.status === 'resolved')
    throw new ConflictError('Impedimento resolvido não muda de responsável')
  return impediment.ownerId === ownerId ? impediment : { ...impediment, ownerId }
}

/** Atualiza o motivo do impedimento aberto (bloquear de novo com outro motivo). */
export function changeImpedimentReason(impediment: Impediment, reason: string): Impediment {
  if (impediment.status === 'resolved') throw new ConflictError('Impedimento já foi resolvido')
  const validated = validateBlockReason(reason)
  return validated === impediment.reason ? impediment : { ...impediment, reason: validated }
}
