import type { OrganizationId, TaskCommentId, TaskId, UserId } from '../shared/ids'
import { ValidationError } from '../shared/errors'

export const COMMENT_BODY_MAX_LENGTH = 2000

/** Comentário numa tarefa. `mentions` é derivado do corpo (ver `extractMentions`). */
export interface TaskComment {
  readonly id: TaskCommentId
  readonly organizationId: OrganizationId
  readonly taskId: TaskId
  readonly authorId: UserId
  readonly body: string
  readonly mentions: readonly UserId[]
  readonly createdAt: string
  readonly editedAt: string | null
  readonly asManager: boolean
}

export function validateCommentBody(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) throw new ValidationError('Comentário obrigatório')
  if (Array.from(trimmed).length > COMMENT_BODY_MAX_LENGTH)
    throw new ValidationError('Comentário deve ter até 2000 caracteres')
  return trimmed
}

export function createTaskComment(input: TaskComment): TaskComment {
  const body = validateCommentBody(input.body)
  if (input.editedAt !== null && input.editedAt < input.createdAt)
    throw new ValidationError('Edição anterior à criação do comentário')
  return { ...input, body, mentions: [...new Set(input.mentions)] }
}
