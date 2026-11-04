import { z } from 'zod'
import { isoDateTimeSchema, ulidSchema } from './shared-schemas'

export const WIP_LIMIT_MIN = 1
export const WIP_LIMIT_MAX = 99

export const wipLimitSchema = z.number().int().min(WIP_LIMIT_MIN).max(WIP_LIMIT_MAX)

/** Só Desenvolvendo e Revisar aceitam limite nesta fase. Chave ausente = sem limite. */
export const wipLimitsSchema = z
  .object({
    in_progress: wipLimitSchema.optional(),
    review: wipLimitSchema.optional(),
  })
  .strict()

export const wipStateSchema = z.enum(['none', 'ok', 'at_limit', 'over'])

/** Contagem de uma coluna de WIP sobre as tarefas que o usuário pode ver. */
export const wipColumnDtoSchema = z.object({
  status: z.enum(['in_progress', 'review']),
  count: z.number().int().nonnegative(),
  limit: wipLimitSchema.nullable(),
  state: wipStateSchema,
})

export const boardSettingsDtoSchema = z.object({
  wipLimits: wipLimitsSchema,
  updatedAt: isoDateTimeSchema.nullable(),
  updatedBy: ulidSchema.nullable(),
})

export const getBoardSettingsInputSchema = z.undefined()
export const getBoardSettingsOutputSchema = boardSettingsDtoSchema
export const setWipLimitsInputSchema = z.object({ wipLimits: wipLimitsSchema })
export const setWipLimitsOutputSchema = boardSettingsDtoSchema

export type BoardSettingsDto = z.infer<typeof boardSettingsDtoSchema>
export type WipColumnDto = z.infer<typeof wipColumnDtoSchema>
export type WipLimitsDto = z.infer<typeof wipLimitsSchema>
export type SetWipLimitsInput = z.infer<typeof setWipLimitsInputSchema>
