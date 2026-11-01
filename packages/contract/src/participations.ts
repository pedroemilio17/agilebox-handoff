import { z } from 'zod'
import { rateCentsSchema, ulidSchema, visibleRateSchema } from './shared-schemas'

export const participantSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user'), userId: ulidSchema }),
  z.object({ kind: z.literal('contributor'), contributorId: ulidSchema }),
])
export const participationRoleSchema = z.enum(['responsible', 'support'])

export const participationSummaryDtoSchema = z.object({
  id: ulidSchema,
  participant: participantSchema,
  participantName: z.string().trim().min(1),
  role: participationRoleSchema,
  hours: z.number().finite().nonnegative(),
  rate: visibleRateSchema,
})

export const addParticipationInputSchema = z
  .object({
    taskId: ulidSchema,
    participant: participantSchema,
    role: participationRoleSchema,
  })
  .refine((input) => input.role !== 'responsible' || input.participant.kind === 'user', {
    message: 'Responsável deve ser usuário',
    path: ['participant'],
  })
export const addParticipationOutputSchema = participationSummaryDtoSchema
export const removeParticipationInputSchema = z.object({
  taskId: ulidSchema,
  participationId: ulidSchema,
})
export const removeParticipationOutputSchema = z.void()
const hoursTextSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:[,.]\d+)?$/u, 'Informe horas como número positivo')
export const setParticipationHoursInputSchema = z.object({
  taskId: ulidSchema,
  participationId: ulidSchema,
  hours: hoursTextSchema,
})
export const setParticipationHoursOutputSchema = participationSummaryDtoSchema
export const setParticipationRateInputSchema = z.object({
  taskId: ulidSchema,
  participationId: ulidSchema,
  rateCents: rateCentsSchema,
})
export const setParticipationRateOutputSchema = participationSummaryDtoSchema

export type Participant = z.infer<typeof participantSchema>
export type ParticipationSummaryDto = z.infer<typeof participationSummaryDtoSchema>
