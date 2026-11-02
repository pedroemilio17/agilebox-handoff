import { z } from 'zod'
import { ulidSchema } from './shared-schemas'
import { taskDtoSchema } from './tasks'

/** `'top'` = primeiro, `'end'` = último, ou índice 0-based dentro do backlog. Espelha `BacklogPlacement` do core. */
export const backlogPlacementSchema = z.union([
  z.literal('top'),
  z.literal('end'),
  z.number().int().nonnegative(),
])

export const listBacklogInputSchema = z.object({ projectId: ulidSchema.optional() })
export const listBacklogOutputSchema = z.array(taskDtoSchema)

export const reorderBacklogInputSchema = z.object({
  taskId: ulidSchema,
  placement: backlogPlacementSchema,
})
export const reorderBacklogOutputSchema = z.void()

export const takeToBoardInputSchema = z.object({ taskId: ulidSchema })
export const takeToBoardOutputSchema = taskDtoSchema

export const sendToBacklogInputSchema = z.object({ taskId: ulidSchema })
export const sendToBacklogOutputSchema = taskDtoSchema

export type BacklogPlacementInput = z.infer<typeof backlogPlacementSchema>
