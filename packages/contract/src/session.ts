import { z } from 'zod'
import { ulidSchema, userRoleSchema, visibleRateSchema } from './shared-schemas'

export const switchUserInputSchema = z.object({ userId: ulidSchema })
export const getCurrentSessionInputSchema = z.undefined()
export const listSessionUsersInputSchema = z.undefined()

export const currentSessionDtoSchema = z.object({
  userId: ulidSchema,
  organizationId: ulidSchema,
  role: userRoleSchema,
})

export const sessionUserDtoSchema = z.object({
  id: ulidSchema,
  name: z.string().trim().min(1),
  initials: z.string().min(1),
  role: userRoleSchema,
  defaultRate: visibleRateSchema,
})

export const getCurrentSessionOutputSchema = currentSessionDtoSchema
export const switchUserOutputSchema = currentSessionDtoSchema
export const listSessionUsersOutputSchema = z.array(sessionUserDtoSchema)

export type SwitchUserInput = z.infer<typeof switchUserInputSchema>
export type CurrentSessionDto = z.infer<typeof currentSessionDtoSchema>
export type SessionUserDto = z.infer<typeof sessionUserDtoSchema>
