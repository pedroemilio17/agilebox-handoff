import { z } from 'zod'
import { estimatedHoursSchema, ulidSchema } from './shared-schemas'
import { taskDtoSchema } from './tasks'

/**
 * Estimativa em horas (M3.7, ADR-07). A entrada chega em horas decimais; o handler converte para
 * centésimos (a unidade do caso de uso) com `Math.round(horas * 100)`, exato porque o schema já
 * recusa mais de duas casas. Nulo limpa a estimativa.
 */
export const setEstimateInputSchema = z.object({
  taskId: ulidSchema,
  estimatedHours: estimatedHoursSchema.nullable(),
})
export const setEstimateOutputSchema = taskDtoSchema

export type SetEstimateInput = z.infer<typeof setEstimateInputSchema>
