import { z } from 'zod'
import { isoDateTimeSchema, ulidSchema } from './shared-schemas'

/** Limites de texto do risco (domínio: `RISK_*_MAX_LENGTH`). */
export const RISK_TITLE_INPUT_MAX = 200
export const RISK_DESCRIPTION_INPUT_MAX = 1000
export const RISK_RESPONSE_INPUT_MAX = 280

/** Probabilidade e impacto: 1 baixa, 2 média, 3 alta. */
export const riskLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])
export const riskStatusSchema = z.enum(['open', 'mitigated', 'occurred', 'closed'])

const riskTitleSchema = z.string().trim().min(1).max(RISK_TITLE_INPUT_MAX)
const riskDescriptionSchema = z.string().trim().max(RISK_DESCRIPTION_INPUT_MAX).nullable()
const riskResponseSchema = z.string().trim().max(RISK_RESPONSE_INPUT_MAX).nullable()

/**
 * Risco como a interface o mostra. `ownerName` vem do dono (nulo sem dono). `deliverableId` nulo =
 * risco do projeto inteiro.
 */
export const riskDtoSchema = z.object({
  id: ulidSchema,
  projectId: ulidSchema,
  title: z.string().min(1),
  description: z.string().nullable(),
  probability: riskLevelSchema,
  impact: riskLevelSchema,
  response: z.string().nullable(),
  ownerId: ulidSchema.nullable(),
  ownerName: z.string().nullable(),
  deliverableId: ulidSchema.nullable(),
  status: riskStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

/** Na lista, o título da entrega vem só quando o módulo `wbs` está ligado no projeto. */
export const riskListItemDtoSchema = riskDtoSchema.extend({
  deliverableTitle: z.string().nullable(),
})

export const createRiskInputSchema = z.object({
  projectId: ulidSchema,
  title: riskTitleSchema,
  description: riskDescriptionSchema,
  probability: riskLevelSchema,
  impact: riskLevelSchema,
  response: riskResponseSchema,
  ownerId: ulidSchema.nullable(),
  deliverableId: ulidSchema.nullable(),
})
export const createRiskOutputSchema = riskDtoSchema

/** Edição parcial: campo ausente não muda. Situação só muda por aqui. */
export const updateRiskInputSchema = z.object({
  riskId: ulidSchema,
  title: riskTitleSchema.optional(),
  description: riskDescriptionSchema.optional(),
  probability: riskLevelSchema.optional(),
  impact: riskLevelSchema.optional(),
  response: riskResponseSchema.optional(),
  ownerId: ulidSchema.nullable().optional(),
  deliverableId: ulidSchema.nullable().optional(),
  status: riskStatusSchema.optional(),
})
export const updateRiskOutputSchema = riskDtoSchema

export const removeRiskInputSchema = z.object({ riskId: ulidSchema })
export const removeRiskOutputSchema = z.void()

/** Leitura dos riscos do projeto (módulo `risks`), já na ordem de pontuação (maior primeiro). */
export const listRisksInputSchema = z.object({ projectId: ulidSchema })
export const listRisksOutputSchema = z.object({
  projectId: ulidSchema,
  /** Quem pode criar, editar e remover riscos (gestor ou criador, projeto ativo). */
  canEdit: z.boolean(),
  risks: z.array(riskListItemDtoSchema),
})

export type RiskDto = z.infer<typeof riskDtoSchema>
export type RiskListItemDto = z.infer<typeof riskListItemDtoSchema>
export type RisksListDto = z.infer<typeof listRisksOutputSchema>
export type CreateRiskInput = z.infer<typeof createRiskInputSchema>
export type UpdateRiskInput = z.infer<typeof updateRiskInputSchema>
