import { z } from 'zod'
import { isoDateTimeSchema, nameSchema, ulidSchema } from './shared-schemas'

export const COMMENT_BODY_MAX_LENGTH = 2000

export const commentBodySchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Array.from(value).length <= COMMENT_BODY_MAX_LENGTH, {
    message: 'Comentário deve ter até 2000 caracteres',
  })

export const commentMentionDtoSchema = z.object({
  id: ulidSchema,
  name: nameSchema,
})

export const taskCommentDtoSchema = z.object({
  id: ulidSchema,
  taskId: ulidSchema,
  authorId: ulidSchema,
  authorName: nameSchema,
  body: z.string().min(1),
  asManager: z.boolean(),
  mentions: z.array(commentMentionDtoSchema),
  createdAt: isoDateTimeSchema,
  editedAt: isoDateTimeSchema.nullable(),
  canEdit: z.boolean(),
  canRemove: z.boolean(),
})

export const addTaskCommentInputSchema = z.object({
  taskId: ulidSchema,
  body: commentBodySchema,
})
export const editTaskCommentInputSchema = z.object({
  taskId: ulidSchema,
  commentId: ulidSchema,
  body: commentBodySchema,
})
export const removeTaskCommentInputSchema = z.object({
  taskId: ulidSchema,
  commentId: ulidSchema,
})
export const addTaskCommentOutputSchema = taskCommentDtoSchema
export const editTaskCommentOutputSchema = taskCommentDtoSchema
export const removeTaskCommentOutputSchema = z.void()

export type TaskCommentDto = z.infer<typeof taskCommentDtoSchema>
export type AddTaskCommentInput = z.infer<typeof addTaskCommentInputSchema>
export type EditTaskCommentInput = z.infer<typeof editTaskCommentInputSchema>
export type RemoveTaskCommentInput = z.infer<typeof removeTaskCommentInputSchema>
