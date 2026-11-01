import { z } from 'zod'

export const ulidSchema = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u)
export const nameSchema = z.string().trim().min(1)
export const isoDateTimeSchema = z.iso.datetime()
export const visibleRateSchema = z.number().finite().nonnegative().nullable()
export const rateCentsSchema = z.number().int().positive().safe()
export const userRoleSchema = z.enum(['collaborator', 'manager'])

export const userSummaryDtoSchema = z.object({
  id: ulidSchema,
  name: nameSchema,
  initials: z.string().min(1),
  role: userRoleSchema,
})

export type UserSummaryDto = z.infer<typeof userSummaryDtoSchema>
