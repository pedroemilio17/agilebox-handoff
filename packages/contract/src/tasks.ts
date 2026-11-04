import { z } from 'zod'
import { checklistItemDtoSchema, checklistProgressDtoSchema } from './checklist'
import { taskCommentDtoSchema } from './comments'
import { isoDateTimeSchema, nameSchema, ulidSchema, visibleRateSchema } from './shared-schemas'

export const taskStatusSchema = z.enum(['planning', 'todo', 'in_progress', 'review', 'done'])
export const taskPrioritySchema = z.enum(['normal', 'high'])
export const taskDeadlineSchema = z.iso.date().nullable()
export const taskBlockReasonSchema = z.string().trim().min(1).max(280)

export const taskKeySchema = z.string().regex(/^[A-Z]{2,5}-[1-9]\d*$/u)

export const taskDtoSchema = z.object({
  id: ulidSchema,
  number: z.number().int().positive().safe(),
  key: taskKeySchema,
  projectId: ulidSchema,
  projectName: nameSchema,
  title: nameSchema,
  description: z.string(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  blockedReason: taskBlockReasonSchema.nullable(),
  blockedAt: isoDateTimeSchema.nullable(),
  deadline: taskDeadlineSchema,
  ticketId: z.number().int().positive().safe().nullable(),
  ticketUrl: z.url().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  checklistProgress: checklistProgressDtoSchema,
  commentCount: z.number().int().nonnegative().safe(),
  agingDays: z.number().int().nonnegative().nullable().optional(),
  overdue: z.boolean().optional(),
})

export const listBoardInputSchema = z.object({
  projectId: ulidSchema.optional(),
  forUserId: ulidSchema.optional(),
})
export const getBoardFlowOutputSchema = z.object({
  cycleDays: z.number().nonnegative().nullable(),
  weekStart: z.iso.date(),
  updatedAt: isoDateTimeSchema,
})
export const listTeamBoardInputSchema = z.object({ projectId: ulidSchema.optional() })
export const listBoardOutputSchema = z.array(taskDtoSchema)
export const listTeamBoardOutputSchema = listBoardOutputSchema
export const getTaskInputSchema = z.object({ taskId: ulidSchema })
export const getTaskOutputSchema = taskDtoSchema
  .extend({
    participations: z.array(z.lazy(() => participationSummaryDtoSchema)),
    checklist: z.array(checklistItemDtoSchema),
    comments: z.array(taskCommentDtoSchema),
    total: visibleRateSchema,
    canEdit: z.boolean(),
    readOnly: z.boolean(),
  })
  .refine((task) => task.canEdit !== task.readOnly, {
    message: 'Detalhe deve ser editável ou somente leitura',
  })
export const createTaskInputSchema = z.object({
  projectId: ulidSchema,
  title: nameSchema,
  status: taskStatusSchema.optional(),
  responsibleId: ulidSchema.optional(),
  deadline: taskDeadlineSchema.optional(),
})
export const createTaskOutputSchema = taskDtoSchema
export const taskUpdateChangesSchema = z
  .object({
    progressConfirmed: z.literal(true).optional(),
    title: nameSchema.optional(),
    description: z.string().optional(),
    priority: taskPrioritySchema.optional(),
    deadline: taskDeadlineSchema.optional(),
    ticketId: z.number().int().positive().safe().nullable().optional(),
    ticketUrl: z.url().nullable().optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0, {
    message: 'Informe ao menos uma alteração',
  })
export const taskUpdateInputSchema = z.object({
  taskId: ulidSchema,
  changes: taskUpdateChangesSchema,
})
export const taskUpdateOutputSchema = taskDtoSchema
export const moveTaskInputSchema = z.object({ taskId: ulidSchema, status: taskStatusSchema })
export const moveTaskOutputSchema = taskDtoSchema
export const blockTaskInputSchema = z.object({ taskId: ulidSchema, reason: taskBlockReasonSchema })
export const blockTaskOutputSchema = taskDtoSchema
export const unblockTaskInputSchema = z.object({ taskId: ulidSchema })
export const unblockTaskOutputSchema = taskDtoSchema
/** Toda alteração de subtarefa devolve a tarefa atualizada (com o progresso). */
export const checklistChangeOutputSchema = taskDtoSchema
export const listRecentTasksInputSchema = z.undefined()
export const listFrequentTasksInputSchema = z.undefined()
export const listRecentTasksOutputSchema = listBoardOutputSchema
export const listFrequentTasksOutputSchema = listBoardOutputSchema
export const searchTasksInputSchema = z.object({ query: nameSchema })
export const searchTasksOutputSchema = listBoardOutputSchema
export const recordTaskOpenInputSchema = z.object({ taskId: ulidSchema })
export const recordTaskOpenOutputSchema = z.void()

import { participationSummaryDtoSchema } from './participations'

export type TaskDto = z.infer<typeof taskDtoSchema>
export type GetTaskDto = z.infer<typeof getTaskOutputSchema>
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>
export type TaskUpdateInput = z.infer<typeof taskUpdateInputSchema>
export type BlockTaskInput = z.infer<typeof blockTaskInputSchema>
