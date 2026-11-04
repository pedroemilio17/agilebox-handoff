import { describe, expect, it } from 'vitest'
import {
  addTaskCommentInputSchema,
  editTaskCommentInputSchema,
  removeTaskCommentInputSchema,
  taskCommentDtoSchema,
} from './comments'

const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const commentId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAX'

describe('contrato de comentários', () => {
  it('aceita corpo de 1 a 2000 caracteres sem contar só espaços', () => {
    expect(addTaskCommentInputSchema.safeParse({ taskId, body: '  oi  ' }).success).toBe(true)
    expect(addTaskCommentInputSchema.safeParse({ taskId, body: '   ' }).success).toBe(false)
    expect(addTaskCommentInputSchema.safeParse({ taskId, body: 'a'.repeat(2000) }).success).toBe(
      true,
    )
    expect(addTaskCommentInputSchema.safeParse({ taskId, body: 'a'.repeat(2001) }).success).toBe(
      false,
    )
  })

  it('exige ids válidos na edição e na remoção', () => {
    expect(editTaskCommentInputSchema.safeParse({ taskId, commentId, body: 'novo' }).success).toBe(
      true,
    )
    expect(
      editTaskCommentInputSchema.safeParse({ taskId, commentId: 'x', body: 'novo' }).success,
    ).toBe(false)
    expect(removeTaskCommentInputSchema.safeParse({ taskId, commentId }).success).toBe(true)
  })

  it('descreve o comentário com autor, menções resolvidas e permissões', () => {
    const dto = {
      id: commentId,
      taskId,
      authorId: userId,
      authorName: 'Ana Silva',
      body: 'Oi @Bruno',
      asManager: false,
      mentions: [{ id: userId, name: 'Bruno Lima' }],
      createdAt: '2026-11-04T12:00:00.000Z',
      editedAt: null,
      canEdit: true,
      canRemove: true,
    }
    expect(taskCommentDtoSchema.parse(dto)).toEqual(dto)
    expect(
      taskCommentDtoSchema.safeParse({ ...dto, mentions: [{ id: 'x', name: 'y' }] }).success,
    ).toBe(false)
  })
})
