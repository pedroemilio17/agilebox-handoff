import { z } from 'zod'
import { isoDateTimeSchema, nameSchema, ulidSchema, visibleRateSchema } from './shared-schemas'

export const taskStatusSchema = z.enum(['planning', 'todo', 'in_progress', 'review', 'done'])
export const taskDeadlineSchema = z.iso.date().nullable()

export const taskDtoSchema = z.object({
  id: ulidSchema,
  projectId: ulidSchema,
  projectName: nameSchema,
  title: nameSchema,
  description: z.string(),
  status: taskStatusSchema,
  deadline: taskDeadlineSchema,
  ticketId: z.number().int().positive().safe().nullable(),
  ticketUrl: z.url().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export const listBoardInputSchema = z.object({
  projectId: ulidSchema.optional(),
  forUserId: ulidSchema.optional(),
})
export const listTeamBoardInputSchema = z.object({ projectId: ulidSchema.optional() })
export const listBoardOutputSchema = z.array(taskDtoSchema)
export const listTeamBoardOutputSchema = listBoardOutputSchema
export const getTaskInputSchema = z.object({ taskId: ulidSchema })
export const getTaskOutputSchema = taskDtoSchema
  .extend({
    participations: z.array(z.lazy(() => participationSummaryDtoSchema)),
    total: visibleRateSchema,
    canEdit: z.boolean(),
    readOnly: z.boolean(),
  })
  .refine((task) => task.canEdit !== task.readOnly, {
    message: 'Detalhe deve ser editável ou somente leitura',
  })
export const createTaskInputSchema = z.object({ projectId: ulidSchema, title: nameSchema })
export const createTaskOutputSchema = taskDtoSchema
export const taskUpdateChangesSchema = z
  .object({
    title: nameSchema.optional(),
    description: z.string().optional(),
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
