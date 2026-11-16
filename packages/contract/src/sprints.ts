import { z } from 'zod'
import { isoDateTimeSchema, nameSchema, ulidSchema } from './shared-schemas'
import { sprintRefStatusSchema, taskDtoSchema } from './tasks'

/** Limites de texto da sprint (domínio: `SPRINT_NAME_MAX_LENGTH` e `SPRINT_GOAL_MAX_LENGTH`). */
export const SPRINT_NAME_INPUT_MAX = 80
export const SPRINT_GOAL_INPUT_MAX = 280

export const sprintStatusSchema = sprintRefStatusSchema
export const sprintClosePolicyKindSchema = z.enum(['return_to_backlog', 'carry_over'])
/** Desfecho de cada linha de histórico (espelha `SPRINT_TASK_OUTCOMES` do domínio). */
export const sprintTaskOutcomeSchema = z.enum([
  'open',
  'completed',
  'returned_to_backlog',
  'carried_over',
  'removed',
  'left_on_board',
])

const sprintNameInputSchema = z.string().trim().max(SPRINT_NAME_INPUT_MAX)
const sprintGoalInputSchema = z.string().trim().max(SPRINT_GOAL_INPUT_MAX).nullable()
const sprintDateSchema = z.iso.date()

/** Sprint como a interface a mostra. `label` é "Sprint N" (o número é sequencial por projeto). */
export const sprintDtoSchema = z.object({
  id: ulidSchema,
  projectId: ulidSchema,
  number: z.number().int().positive().safe(),
  label: z.string(),
  name: nameSchema,
  goal: z.string().nullable(),
  plannedStart: sprintDateSchema,
  plannedEnd: sprintDateSchema,
  status: sprintStatusSchema,
  startedAt: isoDateTimeSchema.nullable(),
  closedAt: isoDateTimeSchema.nullable(),
  closePolicy: sprintClosePolicyKindSchema.nullable(),
  createdBy: ulidSchema,
  createdAt: isoDateTimeSchema,
})

/** Uma linha do histórico da sprint: a tarefa entrou, e pode ter saído com um desfecho. */
export const sprintHistoryRowDtoSchema = z.object({
  taskId: ulidSchema,
  taskKey: z.string(),
  taskTitle: z.string(),
  addedAt: isoDateTimeSchema,
  addedBy: ulidSchema,
  removedAt: isoDateTimeSchema.nullable(),
  removedBy: ulidSchema.nullable(),
  outcome: sprintTaskOutcomeSchema,
})

/** Detalhe: a sprint, os itens que estão nela agora e o histórico completo (nada é apagado). */
export const sprintDetailDtoSchema = z.object({
  sprint: sprintDtoSchema,
  items: z.array(taskDtoSchema),
  history: z.array(sprintHistoryRowDtoSchema),
})

export const listSprintsInputSchema = z.object({
  projectId: ulidSchema,
  status: sprintStatusSchema.optional(),
})
export const listSprintsOutputSchema = z.array(sprintDtoSchema)

export const getSprintInputSchema = z.object({ sprintId: ulidSchema })
export const getSprintOutputSchema = sprintDetailDtoSchema

/** Nome vazio vira "Sprint N" no domínio. Datas são `YYYY-MM-DD`; o início não pode ser depois do fim. */
export const createSprintInputSchema = z.object({
  projectId: ulidSchema,
  name: sprintNameInputSchema.optional(),
  goal: sprintGoalInputSchema.optional(),
  plannedStart: sprintDateSchema,
  plannedEnd: sprintDateSchema,
})
export const createSprintOutputSchema = sprintDetailDtoSchema

/** Edição de nome, meta e datas (rascunho ou ativa). Meta `null` remove a meta. */
export const updateSprintInputSchema = z.object({
  sprintId: ulidSchema,
  name: sprintNameInputSchema.optional(),
  goal: sprintGoalInputSchema.optional(),
  plannedStart: sprintDateSchema.optional(),
  plannedEnd: sprintDateSchema.optional(),
})
export const updateSprintOutputSchema = sprintDetailDtoSchema

export const startSprintInputSchema = z.object({ sprintId: ulidSchema })
export const startSprintOutputSchema = sprintDetailDtoSchema

/**
 * Encerramento. `return_to_backlog` (padrão) devolve os não iniciados ao backlog; `carry_over` leva
 * os abertos para a sprint seguinte, que precisa ser rascunho do mesmo projeto.
 */
export const closeSprintInputSchema = z
  .object({
    sprintId: ulidSchema,
    policy: sprintClosePolicyKindSchema,
    nextSprintId: ulidSchema.optional(),
  })
  .refine((input) => (input.policy === 'carry_over') === (input.nextSprintId !== undefined), {
    message: 'Informe a sprint seguinte só ao levar os itens abertos para ela',
  })
export const closeSprintOutputSchema = sprintDetailDtoSchema

/** Descarte lógico de rascunho. Com itens abertos, `returnToBacklog` precisa ser verdadeiro. */
export const discardSprintInputSchema = z.object({
  sprintId: ulidSchema,
  returnToBacklog: z.boolean().optional(),
})
export const discardSprintOutputSchema = z.object({ sprintId: ulidSchema })

export const addSprintTaskInputSchema = z.object({ sprintId: ulidSchema, taskId: ulidSchema })
export const addSprintTaskOutputSchema = sprintDetailDtoSchema

export const removeSprintTaskInputSchema = z.object({ sprintId: ulidSchema, taskId: ulidSchema })
export const removeSprintTaskOutputSchema = sprintDetailDtoSchema

export type SprintDto = z.infer<typeof sprintDtoSchema>
export type SprintHistoryRowDto = z.infer<typeof sprintHistoryRowDtoSchema>
export type SprintDetailDto = z.infer<typeof sprintDetailDtoSchema>
export type ListSprintsInput = z.infer<typeof listSprintsInputSchema>
export type CreateSprintInput = z.infer<typeof createSprintInputSchema>
export type UpdateSprintInput = z.infer<typeof updateSprintInputSchema>
export type CloseSprintInput = z.infer<typeof closeSprintInputSchema>
export type DiscardSprintInput = z.infer<typeof discardSprintInputSchema>
