import type { ParticipationSummaryDto } from '@agilebox/contract'
import { backlogCopy } from './copy'

/** `'top'` = primeiro, `'end'` = último, ou índice 0-based na ordem global do backlog (igual ao core). */
export type Placement = 'top' | 'end' | number

export type MoveDirection = 'up' | 'down'

export interface BacklogEntry {
  readonly id: string
  readonly projectId: string
}

/** Itens do backlog na ordem do time, filtrados por projeto (null = todos). */
export function visibleBacklog<T extends BacklogEntry>(
  items: readonly T[],
  projectId: string | null,
): T[] {
  return projectId === null ? [...items] : items.filter((item) => item.projectId === projectId)
}

/**
 * Posição global para mover a tarefa uma casa na direção pedida, pulando as que o filtro esconde.
 * O servidor recebe o índice na ordem completa: subir põe antes do vizinho de cima; descer põe
 * depois do vizinho de baixo (o índice dele, que é o correto porque a origem está antes).
 */
export function neighborPlacement<T extends BacklogEntry>(
  items: readonly T[],
  projectId: string | null,
  id: string,
  direction: MoveDirection,
): number | null {
  const visible = visibleBacklog(items, projectId)
  const index = visible.findIndex((item) => item.id === id)
  if (index < 0) return null
  const neighbor = visible[direction === 'up' ? index - 1 : index + 1]
  if (!neighbor) return null
  return items.findIndex((item) => item.id === neighbor.id)
}

/** Solta sobre outra tarefa: a posição é a dela na ordem global. */
export function dropPlacement<T extends BacklogEntry>(
  items: readonly T[],
  overId: string,
): number | null {
  const index = items.findIndex((item) => item.id === overId)
  return index < 0 ? null : index
}

/** Índice final que o servidor vai usar, para saber se o movimento muda alguma coisa. */
export function resolveInsertIndex(placement: Placement, total: number): number {
  if (placement === 'top') return 0
  if (placement === 'end') return Math.max(total - 1, 0)
  return placement
}

/** Anúncio para leitor de tela, no `role="status"`. `to` é o índice final (0-based). */
export function movedNotice(title: string, to: number, total: number): string {
  return backlogCopy.movedTo(title, to + 1, total)
}

/** Aviso com Desfazer: diz se a tarefa subiu ou desceu e a nova posição (1-based). */
export function movedHeadline(title: string, from: number, to: number): string {
  return backlogCopy.movedHeadline(title, to < from ? 'subiu' : 'desceu', to + 1)
}

/** Aviso de escopo: só existe quando a tarefa tem outros participantes. */
export function scopeNoticeFor(others: number): string | null {
  if (others <= 0) return null
  return others === 1 ? backlogCopy.scopeOne : backlogCopy.scopeMany(others)
}

/** Quantas pessoas, além de quem está logado, participam da tarefa (sem repetir ninguém). */
export function countOtherParticipants(
  participations: readonly Pick<ParticipationSummaryDto, 'participant'>[],
  userId: string,
): number {
  const others = new Set<string>()
  for (const { participant } of participations) {
    if (participant.kind === 'user') {
      if (participant.userId !== userId) others.add(`user:${participant.userId}`)
    } else {
      others.add(`contributor:${participant.contributorId}`)
    }
  }
  return others.size
}

/** Horas em pt-BR: "3 h", "1,5 h". */
export function formatHours(hours: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(hours)} h`
}

/** Critérios n/m. Sem resumo, traço; com total zero, "sem critérios". */
export function criteriaLabel(acceptance: { done: number; total: number } | undefined): string {
  if (!acceptance) return backlogCopy.emptyValue
  if (acceptance.total === 0) return backlogCopy.noCriteria
  return `${acceptance.done}/${acceptance.total}`
}
