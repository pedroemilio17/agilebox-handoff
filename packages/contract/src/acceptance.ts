import { z } from 'zod'
import { isoDateTimeSchema, ulidSchema } from './shared-schemas'

export const ACCEPTANCE_TEXT_MAX_LENGTH = 200

export const acceptanceTextSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Array.from(value).length <= ACCEPTANCE_TEXT_MAX_LENGTH, {
    message: 'Critério deve ter até 200 caracteres',
  })

export const acceptanceCriterionDtoSchema = z.object({
  id: ulidSchema,
  taskId: ulidSchema,
  text: acceptanceTextSchema,
  done: z.boolean(),
  position: z.number().int().nonnegative().safe(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export const addAcceptanceCriterionInputSchema = z.object({
  taskId: ulidSchema,
  text: acceptanceTextSchema,
})
export const toggleAcceptanceCriterionInputSchema = z.object({
  taskId: ulidSchema,
  criterionId: ulidSchema,
  done: z.boolean(),
})
export const renameAcceptanceCriterionInputSchema = z.object({
  taskId: ulidSchema,
  criterionId: ulidSchema,
  text: acceptanceTextSchema,
})
export const removeAcceptanceCriterionInputSchema = z.object({
  taskId: ulidSchema,
  criterionId: ulidSchema,
})
export const moveAcceptanceCriterionInputSchema = z.object({
  taskId: ulidSchema,
  criterionId: ulidSchema,
  position: z.number().int().nonnegative().safe(),
})

export type AcceptanceCriterionDto = z.infer<typeof acceptanceCriterionDtoSchema>
export type AddAcceptanceCriterionInput = z.infer<typeof addAcceptanceCriterionInputSchema>
