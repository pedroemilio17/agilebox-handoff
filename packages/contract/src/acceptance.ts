import { z } from 'zod'
import { ulidSchema } from './shared-schemas'

/** Texto do critério: sem espaços nas pontas, não vazio, sem controle, até 200 pontos de código (M3.2). */
const INVISIBLE_ONLY = /^[\s\p{Cc}\p{Cf}]*$/u
const CONTROL_CHARACTER = /\p{Cc}/u
export const ACCEPTANCE_TEXT_MAX_LENGTH = 200

export const criterionTextSchema = z
  .string()
  .trim()
  .refine((text) => !INVISIBLE_ONLY.test(text), { message: 'Critério obrigatório' })
  .refine((text) => !CONTROL_CHARACTER.test(text), {
    message: 'Critério não pode ter caracteres de controle',
  })
  .refine((text) => Array.from(text).length <= ACCEPTANCE_TEXT_MAX_LENGTH, {
    message: `Critério deve ter no máximo ${ACCEPTANCE_TEXT_MAX_LENGTH} caracteres`,
  })

export const acceptanceCriterionDtoSchema = z.object({
  id: ulidSchema,
  text: criterionTextSchema,
  done: z.boolean(),
})

/** Resumo n/m (M3.6): feitos nunca passam do total. */
export const acceptanceSummaryDtoSchema = z
  .object({
    done: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .refine((summary) => summary.done <= summary.total, {
    message: 'Feitos não podem passar do total',
  })

/** Lista na ordem da tarefa com o resumo. É a saída de toda leitura e de toda edição de critérios. */
export const criteriaViewOutputSchema = z
  .object({
    criteria: z.array(acceptanceCriterionDtoSchema),
    summary: acceptanceSummaryDtoSchema,
  })
  .refine(
    (view) =>
      view.summary.total === view.criteria.length &&
      view.summary.done === view.criteria.filter((criterion) => criterion.done).length,
    { message: 'Resumo não bate com a lista de critérios' },
  )

export const listAcceptanceInputSchema = z.object({ taskId: ulidSchema })
export const listAcceptanceOutputSchema = criteriaViewOutputSchema

export const addAcceptanceInputSchema = z.object({
  taskId: ulidSchema,
  text: criterionTextSchema,
})
export const addAcceptanceOutputSchema = criteriaViewOutputSchema

export const editAcceptanceInputSchema = z.object({
  taskId: ulidSchema,
  criterionId: ulidSchema,
  text: criterionTextSchema,
})
export const editAcceptanceOutputSchema = criteriaViewOutputSchema

export const setAcceptanceDoneInputSchema = z.object({
  taskId: ulidSchema,
  criterionId: ulidSchema,
  done: z.boolean(),
})
export const setAcceptanceDoneOutputSchema = criteriaViewOutputSchema

export const removeAcceptanceInputSchema = z.object({
  taskId: ulidSchema,
  criterionId: ulidSchema,
})
export const removeAcceptanceOutputSchema = criteriaViewOutputSchema

/** `toIndex`: posição de destino 0-based, dentro de 0..n-1 (mesmo nome do caso de uso). */
export const reorderAcceptanceInputSchema = z.object({
  taskId: ulidSchema,
  criterionId: ulidSchema,
  toIndex: z.number().int().nonnegative(),
})
export const reorderAcceptanceOutputSchema = criteriaViewOutputSchema

export type AcceptanceCriterionDto = z.infer<typeof acceptanceCriterionDtoSchema>
export type AcceptanceSummaryDto = z.infer<typeof acceptanceSummaryDtoSchema>
export type CriteriaViewDto = z.infer<typeof criteriaViewOutputSchema>
