import { z } from 'zod'
import { createTaskInputSchema, taskDtoSchema } from './tasks'
import { ulidSchema } from './shared-schemas'

/** Backlog do projeto (M3.1): lista ordenada, com `includeArchived` opcional. */
export const listBacklogInputSchema = z.object({
  projectId: ulidSchema,
  includeArchived: z.boolean().optional(),
})
export const listBacklogOutputSchema = z.array(taskDtoSchema)

/**
 * Cria o item já no backlog. Mesmos campos de `tasks.create`, exceto o estado e a definição de
 * pronto: item de backlog começa sempre em Planejamento, e não há conferência ao criar.
 */
export const addToBacklogInputSchema = createTaskInputSchema.omit({
  status: true,
  confirmedDefinitionItemIds: true,
})
export const addToBacklogOutputSchema = taskDtoSchema

/**
 * Reordena um item. Ou `position` (topo ou fim), ou um vizinho (`afterId`: logo depois dele;
 * `beforeId`: logo antes). Os dois vizinhos juntos, desde que sejam consecutivos, também valem.
 */
export const reorderBacklogInputSchema = z
  .object({
    taskId: ulidSchema,
    position: z.enum(['top', 'end']).optional(),
    afterId: ulidSchema.nullable().optional(),
    beforeId: ulidSchema.nullable().optional(),
  })
  .refine(
    (input) => (input.position !== undefined) !== (input.afterId != null || input.beforeId != null),
    { message: 'Informe a posição (topo ou fim) ou um vizinho, não os dois' },
  )
export const reorderBacklogOutputSchema = taskDtoSchema

/** Puxa para o quadro. Padrão: A fazer. Planejamento não é coluna de saída. */
export const pullFromBacklogInputSchema = z.object({
  taskId: ulidSchema,
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  confirmedDefinitionItemIds: z.array(ulidSchema).optional(),
})
export const pullFromBacklogOutputSchema = taskDtoSchema

/** Devolve ao backlog uma tarefa em Planejamento ou A fazer. */
export const sendToBacklogInputSchema = z.object({ taskId: ulidSchema })
export const sendToBacklogOutputSchema = taskDtoSchema

export type ListBacklogInput = z.infer<typeof listBacklogInputSchema>
export type AddToBacklogInput = z.infer<typeof addToBacklogInputSchema>
export type ReorderBacklogInput = z.infer<typeof reorderBacklogInputSchema>
export type PullFromBacklogInput = z.infer<typeof pullFromBacklogInputSchema>
