import { z } from 'zod'
import { checklistItemDtoSchema, checklistProgressDtoSchema } from './checklist'
import { acceptanceCriterionDtoSchema, acceptanceProgressDtoSchema } from './acceptance'
import { taskCommentDtoSchema } from './comments'
import { wipColumnDtoSchema, wipLimitsSchema } from './board-settings'
import { definitionOfDoneItemDtoSchema } from './definition-of-done'
import { isoDateTimeSchema, nameSchema, ulidSchema, visibleRateSchema } from './shared-schemas'

export const taskStatusSchema = z.enum(['planning', 'todo', 'in_progress', 'review', 'done'])
export const taskPrioritySchema = z.enum(['normal', 'high'])
/** Teto de uma estimativa em horas (M3.2). */
export const ESTIMATE_MAX_HOURS = 9999
export const taskDeadlineSchema = z.iso.date().nullable()
export const taskBlockReasonSchema = z.string().trim().min(1).max(280)

export const taskKeySchema = z.string().regex(/^[A-Z]{2,5}-[1-9]\d*$/u)

/** Sprint aberta atual da tarefa (M4.2): "Sprint N" no card. Nulo sem sprint ou sem o módulo ativo. */
export const sprintRefStatusSchema = z.enum(['draft', 'active', 'closed'])
export const sprintRefDtoSchema = z.object({
  id: ulidSchema,
  number: z.number().int().positive().safe(),
  name: z.string(),
  status: sprintRefStatusSchema,
})

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
  /** Nulo quando ativa. Ausente em respostas antigas: tratar como ativa. */
  archivedAt: isoDateTimeSchema.nullable().optional(),
  /** Posição no backlog do projeto (inteiro); nulo = a tarefa está no quadro. Ausente em respostas antigas. */
  backlogRank: z.number().int().safe().nullable().optional(),
  /** Item de backlog: fora do quadro e das listas padrão. Ausente em respostas antigas: tratar como falso. */
  inBacklog: z.boolean().optional(),
  /** Estimativa em horas (ADR-07, módulo `estimates.hours`). Nulo = sem estimativa. Ausente em respostas antigas. */
  estimatedHours: z.number().nonnegative().max(ESTIMATE_MAX_HOURS).nullable().optional(),
  /** Horas realizadas: soma das horas das participações. Ausente em respostas antigas: tratar como zero. */
  actualHours: z.number().nonnegative().optional(),
  deadline: taskDeadlineSchema,
  ticketId: z.number().int().positive().safe().nullable(),
  ticketUrl: z.url().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  checklistProgress: checklistProgressDtoSchema,
  /** Critérios de aceitação feitos e totais (M3.3). Ausente em respostas antigas: não mostrar marcador. */
  criteriaProgress: acceptanceProgressDtoSchema.optional(),
  /** Sprint aberta da tarefa (M4.2). Ausente em respostas antigas: tratar como nulo. */
  sprint: sprintRefDtoSchema.nullable().optional(),
  commentCount: z.number().int().nonnegative().safe(),
  agingDays: z.number().int().nonnegative().nullable().optional(),
  overdue: z.boolean().optional(),
})

export const listBoardInputSchema = z.object({
  projectId: ulidSchema.optional(),
  forUserId: ulidSchema.optional(),
  /** Inclui tarefas arquivadas e as de projeto arquivado (padrão: ocultas). */
  includeArchived: z.boolean().optional(),
})
export const getBoardFlowOutputSchema = z.object({
  cycleDays: z.number().nonnegative().nullable(),
  weekStart: z.iso.date(),
  updatedAt: isoDateTimeSchema,
})
export const listTeamBoardInputSchema = z.object({
  projectId: ulidSchema.optional(),
  includeArchived: z.boolean().optional(),
})
/** Lista simples de tarefas (equipe, recentes, frequentes, busca). */
export const taskListOutputSchema = z.array(taskDtoSchema)
/** Quadro: tarefas visíveis ao usuário, limites da organização e contagem de WIP por coluna. */
export const listBoardOutputSchema = z.object({
  tasks: taskListOutputSchema,
  wipLimits: wipLimitsSchema,
  wipColumns: z.array(wipColumnDtoSchema),
})
export const listTeamBoardOutputSchema = taskListOutputSchema
export const getTaskInputSchema = z.object({ taskId: ulidSchema })
export const getTaskOutputSchema = taskDtoSchema
  .extend({
    participations: z.array(z.lazy(() => participationSummaryDtoSchema)),
    checklist: z.array(checklistItemDtoSchema),
    /** Critérios de aceitação (M3.2), em ordem de posição. Ausente em respostas antigas: tratar como lista vazia. */
    criteria: z.array(acceptanceCriterionDtoSchema).optional(),
    /** Custo estimado (estimativa × valor/hora do Responsável). Nulo quando o ator não vê esse valor/hora. */
    estimatedCost: visibleRateSchema.optional(),
    /** Definição de pronto do projeto, para a conferência ao concluir (vazia = sem conferência). */
    projectDefinitionOfDone: z.array(definitionOfDoneItemDtoSchema),
    comments: z.array(taskCommentDtoSchema),
    total: visibleRateSchema,
    canEdit: z.boolean(),
    readOnly: z.boolean(),
    /** Arquivar ou desarquivar (participante ou gestor), inclusive tarefa arquivada. Ausente em respostas antigas: tratar como falso. */
    canArchive: z.boolean().optional(),
  })
  .refine((task) => task.canEdit !== task.readOnly, {
    message: 'Detalhe deve ser editável ou somente leitura',
  })
/** Ids dos itens da definição de pronto que o usuário confirmou ao concluir a tarefa. */
export const confirmedDefinitionItemIdsSchema = z.array(ulidSchema)
export const createTaskInputSchema = z.object({
  projectId: ulidSchema,
  title: nameSchema,
  status: taskStatusSchema.optional(),
  responsibleId: ulidSchema.optional(),
  deadline: taskDeadlineSchema.optional(),
  confirmedDefinitionItemIds: confirmedDefinitionItemIdsSchema.optional(),
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
export const moveTaskInputSchema = z.object({
  taskId: ulidSchema,
  status: taskStatusSchema,
  confirmedDefinitionItemIds: confirmedDefinitionItemIdsSchema.optional(),
})
export const moveTaskOutputSchema = taskDtoSchema
export const blockTaskInputSchema = z.object({ taskId: ulidSchema, reason: taskBlockReasonSchema })
export const blockTaskOutputSchema = taskDtoSchema
export const unblockTaskInputSchema = z.object({ taskId: ulidSchema })
export const unblockTaskOutputSchema = taskDtoSchema
export const archiveTaskInputSchema = z.object({ taskId: ulidSchema })
export const archiveTaskOutputSchema = taskDtoSchema
export const unarchiveTaskInputSchema = z.object({ taskId: ulidSchema })
export const unarchiveTaskOutputSchema = taskDtoSchema
/** Toda alteração de subtarefa devolve a tarefa atualizada (com o progresso). */
export const checklistChangeOutputSchema = taskDtoSchema
/** Toda alteração de critério devolve a tarefa atualizada. */
export const criteriaChangeOutputSchema = taskDtoSchema
/**
 * Estimativa em horas: número com até 2 casas, de 0 a 9999; nulo remove a estimativa.
 * O domínio refaz a conta em centésimos, então a checagem de casas aqui é só para responder rápido.
 */
export const estimatedHoursSchema = z
  .number()
  .finite()
  .min(0, { message: 'Estimativa deve ser de 0 a 9999 horas' })
  .max(ESTIMATE_MAX_HOURS, { message: 'Estimativa deve ser de 0 a 9999 horas' })
  .refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, {
    message: 'Estimativa aceita até 2 casas decimais',
  })
  .nullable()
export const setTaskEstimateInputSchema = z.object({
  taskId: ulidSchema,
  estimatedHours: estimatedHoursSchema,
})
export const setTaskEstimateOutputSchema = taskDtoSchema
export const listRecentTasksInputSchema = z.undefined()
export const listFrequentTasksInputSchema = z.undefined()
export const listRecentTasksOutputSchema = taskListOutputSchema
export const listFrequentTasksOutputSchema = taskListOutputSchema
export const searchTasksInputSchema = z.object({ query: nameSchema })
export const searchTasksOutputSchema = taskListOutputSchema
export const recordTaskOpenInputSchema = z.object({ taskId: ulidSchema })
export const recordTaskOpenOutputSchema = z.void()

import { participationSummaryDtoSchema } from './participations'

export type TaskDto = z.infer<typeof taskDtoSchema>
export type SprintRefDto = z.infer<typeof sprintRefDtoSchema>
export type ListBoardDto = z.infer<typeof listBoardOutputSchema>
export type GetTaskDto = z.infer<typeof getTaskOutputSchema>
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>
export type TaskUpdateInput = z.infer<typeof taskUpdateInputSchema>
export type BlockTaskInput = z.infer<typeof blockTaskInputSchema>
