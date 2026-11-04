import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toOrganizationId, toTaskCommentId, toTaskId, toUserId } from '../shared/ids'
import { COMMENT_BODY_MAX_LENGTH, createTaskComment, validateCommentBody } from './task-comment'
import type { TaskComment } from './task-comment'

const id = (n: number) => String(n).padStart(26, '0')
const base: TaskComment = {
  id: toTaskCommentId(id(10)),
  organizationId: toOrganizationId(id(1)),
  taskId: toTaskId(id(2)),
  authorId: toUserId(id(3)),
  body: 'Revisei os endpoints',
  mentions: [],
  createdAt: '2026-01-02T10:00:00.000Z',
  editedAt: null,
  asManager: false,
}

describe('comentário', () => {
  it('aceita de 1 a 2000 caracteres e não conta só espaços', () => {
    expect(validateCommentBody('  oi  ')).toBe('oi')
    expect(() => validateCommentBody('   \n ')).toThrow(ValidationError)
    expect(validateCommentBody('a'.repeat(COMMENT_BODY_MAX_LENGTH))).toHaveLength(2000)
    expect(() => validateCommentBody('a'.repeat(COMMENT_BODY_MAX_LENGTH + 1))).toThrow(
      'Comentário deve ter até 2000 caracteres',
    )
  })

  it('conta caracteres e não bytes ao validar o limite', () => {
    expect(validateCommentBody('ç'.repeat(COMMENT_BODY_MAX_LENGTH))).toHaveLength(2000)
    expect(() => validateCommentBody('ç'.repeat(COMMENT_BODY_MAX_LENGTH + 1))).toThrow(
      ValidationError,
    )
  })

  it('guarda o corpo aparado, sem menções repetidas e rejeita edição anterior à criação', () => {
    const user = toUserId(id(4))
    const created = createTaskComment({ ...base, body: ' oi ', mentions: [user, user] })
    expect(created.body).toBe('oi')
    expect(created.mentions).toEqual([user])
    expect(() => createTaskComment({ ...base, editedAt: '2026-01-01T00:00:00.000Z' })).toThrow(
      ValidationError,
    )
  })
})
