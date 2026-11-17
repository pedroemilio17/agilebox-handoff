import { z } from 'zod'
import { isoDateTimeSchema, ulidSchema } from './shared-schemas'

/** Limites de texto do marco (domínio: `MILESTONE_TITLE_MAX_LENGTH` e `MILESTONE_CRITERION_MAX_LENGTH`). */
export const MILESTONE_TITLE_INPUT_MAX = 200
export const MILESTONE_CRITERION_INPUT_MAX = 280

const milestoneTitleSchema = z.string().trim().min(1).max(MILESTONE_TITLE_INPUT_MAX)
const milestoneCriterionSchema = z.string().trim().max(MILESTONE_CRITERION_INPUT_MAX).nullable()
const milestoneDateSchema = z.iso.date()

/** Marco como a interface o mostra. `deliverableId` nulo = sem entrega ligada. */
export const milestoneDtoSchema = z.object({
  id: ulidSchema,
  projectId: ulidSchema,
  title: z.string().min(1),
  dueOn: milestoneDateSchema,
  deliverableId: ulidSchema.nullable(),
  criterion: z.string().nullable(),
  createdAt: isoDateTimeSchema,
})

export const createMilestoneInputSchema = z.object({
  projectId: ulidSchema,
  title: milestoneTitleSchema,
  dueOn: milestoneDateSchema,
  deliverableId: ulidSchema.nullable(),
  criterion: milestoneCriterionSchema,
})
export const createMilestoneOutputSchema = milestoneDtoSchema

/** Edição parcial: campo ausente não muda. */
export const updateMilestoneInputSchema = z.object({
  milestoneId: ulidSchema,
  title: milestoneTitleSchema.optional(),
  dueOn: milestoneDateSchema.optional(),
  deliverableId: ulidSchema.nullable().optional(),
  criterion: milestoneCriterionSchema.optional(),
})
export const updateMilestoneOutputSchema = milestoneDtoSchema

export const removeMilestoneInputSchema = z.object({ milestoneId: ulidSchema })
export const removeMilestoneOutputSchema = z.void()

/**
 * Marco na tela de Marcos: o `deliverableTitle` vem só quando o módulo da EAP (`wbs`) está ligado no
 * projeto (senão a entrega não é mostrada) e a entrega existe; nos outros casos, nulo.
 */
export const milestoneListItemDtoSchema = milestoneDtoSchema.extend({
  deliverableTitle: z.string().nullable(),
})

/** Leitura de marcos do projeto (módulo `milestones`, não depende de `wbs`). */
export const listMilestonesInputSchema = z.object({ projectId: ulidSchema })
export const listMilestonesOutputSchema = z.object({
  projectId: ulidSchema,
  /** Quem pode criar, editar e remover marcos (gestor ou criador, projeto ativo). */
  canEdit: z.boolean(),
  milestones: z.array(milestoneListItemDtoSchema),
})

export type MilestoneDto = z.infer<typeof milestoneDtoSchema>
export type MilestoneListItemDto = z.infer<typeof milestoneListItemDtoSchema>
export type MilestonesListDto = z.infer<typeof listMilestonesOutputSchema>
export type CreateMilestoneInput = z.infer<typeof createMilestoneInputSchema>
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneInputSchema>
