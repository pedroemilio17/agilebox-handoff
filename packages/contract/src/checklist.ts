import { z } from 'zod'
import { isoDateTimeSchema, ulidSchema } from './shared-schemas'

export const CHECKLIST_TITLE_MAX_LENGTH = 200
export const CHECKLIST_MAX_ITEMS = 50

export const checklistTitleSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Array.from(value).length <= CHECKLIST_TITLE_MAX_LENGTH, {
    message: 'Subtarefa deve ter até 200 caracteres',
  })

export const checklistItemDtoSchema = z.object({
  id: ulidSchema,
  taskId: ulidSchema,
  title: checklistTitleSchema,
  done: z.boolean(),
  position: z.number().int().nonnegative().safe(),
  createdAt: isoDateTimeSchema,
  doneAt: isoDateTimeSchema.nullable(),
})

export const checklistProgressDtoSchema = z.object({
  done: z.number().int().nonnegative().safe(),
  total: z.number().int().nonnegative().safe(),
  percent: z.number().int().min(0).max(100),
})

export const addChecklistItemInputSchema = z.object({
  taskId: ulidSchema,
  title: checklistTitleSchema,
})
export const toggleChecklistItemInputSchema = z.object({
  taskId: ulidSchema,
  itemId: ulidSchema,
  done: z.boolean(),
})
export const renameChecklistItemInputSchema = z.object({
  taskId: ulidSchema,
  itemId: ulidSchema,
  title: checklistTitleSchema,
})
export const removeChecklistItemInputSchema = z.object({
  taskId: ulidSchema,
  itemId: ulidSchema,
})
export const moveChecklistItemInputSchema = z.object({
  taskId: ulidSchema,
  itemId: ulidSchema,
  position: z.number().int().nonnegative().safe(),
})

export type ChecklistItemDto = z.infer<typeof checklistItemDtoSchema>
export type ChecklistProgressDto = z.infer<typeof checklistProgressDtoSchema>
export type AddChecklistItemInput = z.infer<typeof addChecklistItemInputSchema>
