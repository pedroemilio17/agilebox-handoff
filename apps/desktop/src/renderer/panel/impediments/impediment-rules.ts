import type { GetTaskDto, ImpedimentListItemDto, SessionUserDto } from '@agilebox/contract'
import { impedimentCopy } from './impediment-copy'

/** Mesmo limite da nota de resolução no contrato (`impedimentResolutionSchema`). */
export const RESOLUTION_MAX_LENGTH = 280

/** Nota de resolução: opcional, até 280 caracteres (sem contar espaços das pontas). */
export function validateResolutionInput(value: string): string | null {
  return Array.from(value.trim()).length > RESOLUTION_MAX_LENGTH
    ? impedimentCopy.resolutionTooLong
    : null
}

/** Valor do seletor de responsável: vazio é "Sem responsável" (null no servidor). */
export function ownerValue(ownerId: string | null | undefined): string {
  return ownerId ?? ''
}

export function ownerIdFromSelect(value: string): string | null {
  return value === '' ? null : value
}

export interface OwnerCandidate {
  readonly id: string
  readonly name: string
}

/**
 * Quem pode resolver (PLANO-2.0, M5.2a): participantes da tarefa (usuários) e o gestor. Primeiro os
 * participantes, na ordem do detalhe; depois os gestores que não participam. Sem repetir pessoa.
 */
export function ownerCandidates(
  task: Pick<GetTaskDto, 'participations'> | undefined,
  users: readonly SessionUserDto[],
): OwnerCandidate[] {
  const seen = new Set<string>()
  const candidates: OwnerCandidate[] = []
  const add = (id: string, name: string) => {
    if (seen.has(id)) return
    seen.add(id)
    candidates.push({ id, name })
  }
  for (const participation of task?.participations ?? []) {
    if (participation.participant.kind === 'user')
      add(participation.participant.userId, participation.participantName)
  }
  for (const user of users) if (user.role === 'manager') add(user.id, user.name)
  return candidates
}

/** Impedimentos da lista do mais antigo para o mais novo; empate pelo id (ordem estável). */
export function byOldestFirst(
  a: Pick<ImpedimentListItemDto, 'openedAt' | 'id'>,
  b: Pick<ImpedimentListItemDto, 'openedAt' | 'id'>,
): number {
  return a.openedAt.localeCompare(b.openedAt) || a.id.localeCompare(b.id)
}
