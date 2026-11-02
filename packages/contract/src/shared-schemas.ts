import { z } from 'zod'

export const ulidSchema = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u)
export const nameSchema = z.string().trim().min(1)
export const isoDateTimeSchema = z.iso.datetime()
export const visibleRateSchema = z.number().finite().nonnegative().nullable()
export const rateCentsSchema = z.number().int().positive().safe()
/** Horas estimadas da tarefa (M3.7, ADR-07): decimais de 0 a 1000 h, com no máximo duas casas. */
export const estimatedHoursSchema = z
  .number()
  .finite()
  .nonnegative()
  .max(1000)
  .refine((hours) => Math.abs(hours * 100 - Math.round(hours * 100)) < 1e-6, {
    message: 'Use no máximo duas casas decimais',
  })
export const userRoleSchema = z.enum(['collaborator', 'manager'])

export const userSummaryDtoSchema = z.object({
  id: ulidSchema,
  name: nameSchema,
  initials: z.string().min(1),
  role: userRoleSchema,
})

export type UserSummaryDto = z.infer<typeof userSummaryDtoSchema>
