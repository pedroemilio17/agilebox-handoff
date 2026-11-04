import { z } from 'zod'
import { ulidSchema } from './shared-schemas'

export const DEFINITION_OF_DONE_TITLE_MAX_LENGTH = 200
export const DEFINITION_OF_DONE_MAX_ITEMS = 20

export const definitionOfDoneTitleSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Array.from(value).length <= DEFINITION_OF_DONE_TITLE_MAX_LENGTH, {
    message: 'Item da definição de pronto deve ter até 200 caracteres',
  })

export const definitionOfDoneItemDtoSchema = z.object({
  id: ulidSchema,
  projectId: ulidSchema,
  title: definitionOfDoneTitleSchema,
  position: z.number().int().nonnegative().safe(),
})

/** Item que a conclusão não confirmou, para a UI abrir a conferência. */
export const missingDefinitionItemDtoSchema = z.object({
  id: ulidSchema,
  title: definitionOfDoneTitleSchema,
})

export const listDefinitionOfDoneInputSchema = z.object({ projectId: ulidSchema })
export const listDefinitionOfDoneOutputSchema = z.array(definitionOfDoneItemDtoSchema)
export const addDefinitionOfDoneItemInputSchema = z.object({
  projectId: ulidSchema,
  title: definitionOfDoneTitleSchema,
})
export const renameDefinitionOfDoneItemInputSchema = z.object({
  projectId: ulidSchema,
  itemId: ulidSchema,
  title: definitionOfDoneTitleSchema,
})
export const removeDefinitionOfDoneItemInputSchema = z.object({
  projectId: ulidSchema,
  itemId: ulidSchema,
})
export const moveDefinitionOfDoneItemInputSchema = z.object({
  projectId: ulidSchema,
  itemId: ulidSchema,
  position: z.number().int().nonnegative().safe(),
})
/** Toda alteração da definição devolve a lista completa, já ordenada. */
export const definitionOfDoneChangeOutputSchema = listDefinitionOfDoneOutputSchema

export type DefinitionOfDoneItemDto = z.infer<typeof definitionOfDoneItemDtoSchema>
export type MissingDefinitionItemDto = z.infer<typeof missingDefinitionItemDtoSchema>
export type AddDefinitionOfDoneItemInput = z.infer<typeof addDefinitionOfDoneItemInputSchema>
export type RenameDefinitionOfDoneItemInput = z.infer<typeof renameDefinitionOfDoneItemInputSchema>
export type MoveDefinitionOfDoneItemInput = z.infer<typeof moveDefinitionOfDoneItemInputSchema>
