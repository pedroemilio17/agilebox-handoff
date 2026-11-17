import { z } from 'zod'
import { isoDateTimeSchema, ulidSchema } from './shared-schemas'

/**
 * Impedimentos (M5.2a). `reason` tem o mesmo limite do bloqueio (280); `resolution` é a nota
 * opcional de resolução (até 280). Espelha `IMPEDIMENT_STATUSES` e `IMPEDIMENT_RESOLUTION_MAX_LENGTH`.
 */
export const impedimentStatusSchema = z.enum(['open', 'resolved'])
export const impedimentReasonSchema = z.string().trim().min(1).max(280)
export const impedimentResolutionSchema = z.string().trim().max(280)

/** Impedimento como a interface o mostra. `ownerName` é nulo quando não há responsável. */
export const impedimentDtoSchema = z.object({
  id: ulidSchema,
  taskId: ulidSchema,
  status: impedimentStatusSchema,
  reason: z.string(),
  ownerId: ulidSchema.nullable(),
  ownerName: z.string().nullable(),
  openedBy: ulidSchema,
  openedAt: isoDateTimeSchema,
  resolvedBy: ulidSchema.nullable(),
  resolvedAt: isoDateTimeSchema.nullable(),
  resolution: z.string().nullable(),
})

/** Resumo do impedimento aberto, no cartão e no detalhe da tarefa (`TaskDto.impediment`). */
export const impedimentRefDtoSchema = z.object({
  id: ulidSchema,
  status: impedimentStatusSchema,
  reason: z.string(),
  ownerId: ulidSchema.nullable(),
  ownerName: z.string().nullable(),
  openedAt: isoDateTimeSchema,
})

/** Lista de impedimentos: o impedimento e a tarefa dele (chave, título e projeto). */
export const impedimentListItemDtoSchema = impedimentDtoSchema.extend({
  taskKey: z.string(),
  taskTitle: z.string(),
  projectId: ulidSchema,
  projectName: z.string(),
})

/** Padrão: só abertos. `ownerId` filtra pelo responsável; `projectId` pelo projeto. */
export const listImpedimentsInputSchema = z.object({
  projectId: ulidSchema.optional(),
  ownerId: ulidSchema.optional(),
  includeResolved: z.boolean().optional(),
})
export const listImpedimentsOutputSchema = z.array(impedimentListItemDtoSchema)

/** Troca o responsável; `null` limpa. O novo responsável precisa participar da tarefa ou ser o gestor. */
export const assignImpedimentInputSchema = z.object({
  impedimentId: ulidSchema,
  ownerId: ulidSchema.nullable(),
})
export const assignImpedimentOutputSchema = impedimentDtoSchema

/** Resolver é o desbloqueio com nota: a tarefa sai do estado bloqueado. */
export const resolveImpedimentInputSchema = z.object({
  impedimentId: ulidSchema,
  resolution: impedimentResolutionSchema.nullable().optional(),
})
export const resolveImpedimentOutputSchema = impedimentDtoSchema

export type ImpedimentDto = z.infer<typeof impedimentDtoSchema>
export type ImpedimentRefDto = z.infer<typeof impedimentRefDtoSchema>
export type ImpedimentListItemDto = z.infer<typeof impedimentListItemDtoSchema>
export type ListImpedimentsInput = z.infer<typeof listImpedimentsInputSchema>
export type AssignImpedimentInput = z.infer<typeof assignImpedimentInputSchema>
export type ResolveImpedimentInput = z.infer<typeof resolveImpedimentInputSchema>
