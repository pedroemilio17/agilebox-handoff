import { z } from 'zod'
import { rateCentsSchema, ulidSchema, visibleRateSchema } from './shared-schemas'

export const setDefaultRateInputSchema = z.object({
  userId: ulidSchema,
  rateCents: rateCentsSchema,
})

export const userDtoSchema = z.object({
  id: ulidSchema,
  name: z.string().trim().min(1),
  email: z.email(),
  initials: z.string().min(1),
  role: z.enum(['collaborator', 'manager']),
  defaultRate: visibleRateSchema,
})

export const setDefaultRateOutputSchema = userDtoSchema

export type SetDefaultRateInput = z.infer<typeof setDefaultRateInputSchema>
export type UserDto = z.infer<typeof userDtoSchema>
