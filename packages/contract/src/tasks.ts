import { z } from 'zod'
import {
  estimatedHoursSchema,
  isoDateTimeSchema,
  nameSchema,
  ulidSchema,
  visibleRateSchema,
} from './shared-schemas'
import { acceptanceSummaryDtoSchema } from './acceptance'

export const taskStatusSchema = z.enum(['planning', 'todo', 'in_progress', 'review', 'done'])
export const taskDeadlineSchema = z.iso.date().nullable()
export const taskListScopeSchema = z.enum(['mine', 'team'])

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
  agingDays: z.number().int().nonnegative().nullable().optional(),
  overdue: z.boolean().optional(),
  /** Posição 1..n no backlog do time; nulo = fora do backlog (B1 A). */
  backlogRank: z.number().int().positive().nullable(),
  /** Visível no quadro. Sempre `backlogRank === null` (invariante do core, M3.1). */
  onBoard: z.boolean(),
  /** Estimativa em horas decimais (0,01 h); nulo = sem estimativa (M3.7). */
  estimatedHours: estimatedHoursSchema.nullable(),
  /** Custo estimado em R$ que o ator pode ver; nulo quando não pode (gestor vê o total, colaborador a própria parcela). */
  estimatedCost: visibleRateSchema,
  /** Custo realizado em R$ que o ator pode ver; mesma regra de visibilidade do estimado. */
  realizedCost: visibleRateSchema,
  /** Resumo n/m dos critérios de aceite (M3.6). Ausente quando a tarefa não traz o resumo. */
  acceptance: acceptanceSummaryDtoSchema.optional(),
})

export const listBoardInputSchema = z.object({
  projectId: ulidSchema.optional(),
  forUserId: ulidSchema.optional(),
  scope: taskListScopeSchema.optional(),
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
  /** Cria a tarefa no fim do backlog do time, fora do quadro (M3.5, Q4). */
  inBacklog: z.boolean().optional(),
})
export const createTaskOutputSchema = taskDtoSchema
export const taskUpdateChangesSchema = z
  .object({
    progressConfirmed: z.literal(true).optional(),
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
export const listArchivedTasksInputSchema = z.undefined()
export const listArchivedTasksOutputSchema = listBoardOutputSchema
export const searchTasksInputSchema = z.object({ query: nameSchema })
export const searchTasksOutputSchema = listBoardOutputSchema
export const archiveTaskInputSchema = z.object({ taskId: ulidSchema })
export const unarchiveTaskInputSchema = archiveTaskInputSchema
export const archiveTaskOutputSchema = taskDtoSchema
export const recordTaskOpenInputSchema = z.object({ taskId: ulidSchema })
export const recordTaskOpenOutputSchema = z.void()

import { participationSummaryDtoSchema } from './participations'

export type TaskDto = z.infer<typeof taskDtoSchema>
export type GetTaskDto = z.infer<typeof getTaskOutputSchema>
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>
export type TaskUpdateInput = z.infer<typeof taskUpdateInputSchema>
