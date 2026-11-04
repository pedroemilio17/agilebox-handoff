import { describe, expect, it } from 'vitest'
import type { TaskComment } from '../entities/task-comment'
import { describeEvent } from './timeline'
import type { TimelineEvent } from '../entities/timeline-event'
import type { Actor } from '../policies/actor'
import { toEventId, toOrganizationId, toTaskCommentId, toTaskId, toUserId } from '../shared/ids'
import {
  COMMENT_EXCERPT_MAX_LENGTH,
  commentAddedDraft,
  commentExcerpt,
  commentRemovedDraft,
  extractMentions,
} from './comments'
import type { MentionCandidate } from './comments'

const id = (n: number) => String(n).padStart(26, '0')
const ana: MentionCandidate = { id: toUserId(id(1)), name: 'Ana Silva', initials: 'AS' }
const bruno: MentionCandidate = { id: toUserId(id(2)), name: 'Bruno Lima', initials: 'BL' }
const bruna: MentionCandidate = { id: toUserId(id(3)), name: 'Bruna Costa', initials: 'BC' }
const candidates = [ana, bruno, bruna]

describe('menções em comentários', () => {
  it('reconhece nome completo, iniciais e prefixo único, sem diferenciar acentos nem caixa', () => {
    expect(extractMentions('Oi @Ana Silva, pode olhar?', candidates)).toEqual([ana.id])
    expect(extractMentions('Veja com @as', candidates)).toEqual([ana.id])
    expect(extractMentions('@lima revisa', candidates)).toEqual([])
    expect(extractMentions('@Bruno revisa', candidates)).toEqual([bruno.id])
  })

  it('deixa como texto simples a menção ambígua ou desconhecida', () => {
    expect(extractMentions('@Bru olha isso', candidates)).toEqual([])
    expect(extractMentions('@Carla olha isso', candidates)).toEqual([])
  })

  it('não casa menção colada em outra palavra nem e-mail', () => {
    expect(extractMentions('contato ana@agilebox.demo', candidates)).toEqual([])
  })

  it('não repete a mesma pessoa e mantém a ordem de aparição', () => {
    expect(extractMentions('@Bruno e @Ana, @bruno de novo', candidates)).toEqual([bruno.id, ana.id])
  })

  it('só considera os candidatos informados (entidades não entram)', () => {
    expect(extractMentions('@Cliente Alfa olha', [])).toEqual([])
  })
})

describe('trecho e eventos de comentário', () => {
  it('limita o trecho a 80 caracteres numa linha', () => {
    const excerpt = commentExcerpt(`primeira\nlinha ${'x'.repeat(200)}`)
    expect(Array.from(excerpt)).toHaveLength(COMMENT_EXCERPT_MAX_LENGTH)
    expect(excerpt.startsWith('primeira linha ')).toBe(true)
  })

  it('gera eventos de adição e remoção com o id do comentário', () => {
    const comment: TaskComment = {
      id: toTaskCommentId(id(9)),
      organizationId: toOrganizationId(id(1)),
      taskId: toTaskId(id(2)),
      authorId: ana.id,
      body: 'Texto do comentário',
      mentions: [],
      createdAt: '2026-01-02T10:00:00.000Z',
      editedAt: null,
      asManager: false,
    }
    expect(commentAddedDraft(comment)).toEqual({
      type: 'comment_added',
      payload: { commentId: comment.id, excerpt: 'Texto do comentário' },
    })
    expect(commentRemovedDraft(comment)).toEqual({
      type: 'comment_removed',
      payload: { commentId: comment.id },
    })
  })

  it('descreve os eventos sem repetir o texto do comentário', () => {
    const viewer: Actor = {
      userId: ana.id,
      organizationId: toOrganizationId(id(1)),
      role: 'collaborator',
    }
    const names = {
      organizationId: viewer.organizationId,
      user: () => 'Ana',
      contributor: () => 'Entidade',
    }
    const base = {
      id: toEventId(id(20)),
      taskId: toTaskId(id(2)),
      at: '2026-01-02T10:00:00.000Z',
      actorUserId: ana.id,
      asManager: false,
    }
    const added: TimelineEvent = {
      ...base,
      type: 'comment_added',
      payload: { commentId: toTaskCommentId(id(9)), excerpt: 'segredo' },
    }
    const removed: TimelineEvent = {
      ...base,
      type: 'comment_removed',
      payload: { commentId: toTaskCommentId(id(9)) },
    }
    expect(describeEvent(added, viewer, names)).toBe('comentou na tarefa')
    expect(describeEvent(removed, viewer, names)).toBe('removeu um comentário')
  })
})
