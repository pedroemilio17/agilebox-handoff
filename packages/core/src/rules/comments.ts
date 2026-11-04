import type { TaskComment } from '../entities/task-comment'
import type { TimelineEventDraft } from './timeline'
import type { UserId } from '../shared/ids'
import { foldReference, matchReference } from './reference-match'

/** Pessoa que pode ser mencionada: só participantes-usuários da tarefa (entidades ficam de fora). */
export interface MentionCandidate {
  readonly id: UserId
  readonly name: string
  readonly initials: string
}

export const COMMENT_EXCERPT_MAX_LENGTH = 80

/**
 * Reconhece `@nome` por nome completo, iniciais ou prefixo único.
 * Menção ambígua ou desconhecida fica como texto simples. Não gera aviso: só fica registrada.
 */
export function extractMentions(body: string, candidates: readonly MentionCandidate[]): UserId[] {
  const text = foldReference(body)
  const found: UserId[] = []
  for (const match of text.matchAll(/(^|\s)@/gu)) {
    const index = match.index + match[1]!.length
    const hit = matchReference(text.slice(index + 1), candidates)
    if (hit && !found.includes(hit.entry.id)) found.push(hit.entry.id)
  }
  return found
}

/** Trecho do corpo para a linha do tempo: uma linha, no máximo 80 caracteres. */
export function commentExcerpt(body: string): string {
  return Array.from(body.replace(/\s+/gu, ' ').trim()).slice(0, COMMENT_EXCERPT_MAX_LENGTH).join('')
}

export function commentAddedDraft(comment: TaskComment): TimelineEventDraft {
  return {
    type: 'comment_added',
    payload: { commentId: comment.id, excerpt: commentExcerpt(comment.body) },
  }
}

export function commentRemovedDraft(comment: TaskComment): TimelineEventDraft {
  return { type: 'comment_removed', payload: { commentId: comment.id } }
}
