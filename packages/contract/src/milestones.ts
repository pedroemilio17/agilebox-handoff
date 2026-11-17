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

export type MilestoneDto = z.infer<typeof milestoneDtoSchema>
