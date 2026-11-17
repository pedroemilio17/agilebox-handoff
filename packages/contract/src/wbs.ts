import { z } from 'zod'
import { milestoneDtoSchema } from './milestones'
import { taskDeadlineSchema, taskStatusSchema } from './tasks'
import { nameSchema, ulidSchema, visibleRateSchema } from './shared-schemas'

/** Limite do título de entrega (domínio: `DELIVERABLE_TITLE_MAX_LENGTH`). */
export const DELIVERABLE_TITLE_INPUT_MAX = 200
/** A EAP aceita até 3 níveis (domínio: `MAX_DELIVERABLE_DEPTH`). */
export const WBS_MAX_LEVEL = 3

const deliverableTitleSchema = z.string().trim().min(1).max(DELIVERABLE_TITLE_INPUT_MAX)

/** Totais de uma entrega, somando as subentregas. `cost` é nulo para quem não é gestor. */
export const wbsTotalsDtoSchema = z.object({
  hours: z.number().nonnegative(),
  cost: visibleRateSchema,
  progress: z.number().int().min(0).max(100),
  tasks: z.number().int().nonnegative(),
  milestones: z.array(z.object({ id: ulidSchema, title: z.string().min(1), dueOn: z.iso.date() })),
})

export const wbsDeliverableRowDtoSchema = z.object({
  kind: z.literal('deliverable'),
  id: ulidSchema,
  parentId: ulidSchema.nullable(),
  code: z.string().min(1),
  title: nameSchema,
  level: z.number().int().min(1).max(WBS_MAX_LEVEL),
  totals: wbsTotalsDtoSchema,
})

/** Tarefa como folha da EAP. `done` vale só para o estado Concluído. */
export const wbsTaskRowDtoSchema = z.object({
  kind: z.literal('task'),
  taskId: ulidSchema,
  key: z.string().min(1),
  title: z.string().min(1),
  status: taskStatusSchema,
  deliverableId: ulidSchema,
  responsibleName: z.string().nullable(),
  estimatedHours: z.number().nonnegative().nullable(),
  deadline: taskDeadlineSchema,
  done: z.boolean(),
})

export const wbsViewDtoSchema = z.object({
  projectId: ulidSchema,
  /** Quem pode criar, renomear, mover e remover entregas e marcos (gestor ou criador, projeto ativo). */
  canEdit: z.boolean(),
  deliverables: z.array(
    z.discriminatedUnion('kind', [wbsDeliverableRowDtoSchema, wbsTaskRowDtoSchema]),
  ),
  summary: z.object({
    deliverables: z.number().int().nonnegative(),
    tasks: z.number().int().nonnegative(),
    hours: z.number().nonnegative(),
    cost: visibleRateSchema,
    progress: z.number().int().min(0).max(100),
  }),
  milestones: z.array(milestoneDtoSchema),
  tasksWithoutDeliverable: z.number().int().nonnegative(),
})

export const getWbsInputSchema = z.object({ projectId: ulidSchema })
export const getWbsOutputSchema = wbsViewDtoSchema

export const createDeliverableInputSchema = z.object({
  projectId: ulidSchema,
  parentId: ulidSchema.nullable(),
  title: deliverableTitleSchema,
})
export const createDeliverableOutputSchema = wbsViewDtoSchema

export const renameDeliverableInputSchema = z.object({
  deliverableId: ulidSchema,
  title: deliverableTitleSchema,
})
export const renameDeliverableOutputSchema = wbsViewDtoSchema

export const moveDeliverableInputSchema = z.object({
  deliverableId: ulidSchema,
  parentId: ulidSchema.nullable(),
  position: z.number().int().nonnegative().safe(),
})
export const moveDeliverableOutputSchema = wbsViewDtoSchema

export const removeDeliverableInputSchema = z.object({ deliverableId: ulidSchema })
export const removeDeliverableOutputSchema = wbsViewDtoSchema

export type WbsViewDto = z.infer<typeof wbsViewDtoSchema>
export type WbsRowDto = WbsViewDto['deliverables'][number]
