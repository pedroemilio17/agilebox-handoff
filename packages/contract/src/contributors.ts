import { z } from 'zod'
import { nameSchema, rateCentsSchema, ulidSchema, visibleRateSchema } from './shared-schemas'

export const listContributorsInputSchema = z.undefined()
export const createContributorInputSchema = z.object({ name: nameSchema })
export const setContributorDefaultRateInputSchema = z.object({
  contributorId: ulidSchema,
  rateCents: rateCentsSchema,
})

export const contributorDtoSchema = z.object({
  id: ulidSchema,
  name: nameSchema,
  defaultRate: visibleRateSchema,
})

export const createContributorOutputSchema = contributorDtoSchema
export const listContributorsOutputSchema = z.array(contributorDtoSchema)
export const setContributorDefaultRateOutputSchema = contributorDtoSchema

export type CreateContributorInput = z.infer<typeof createContributorInputSchema>
export type SetContributorDefaultRateInput = z.infer<typeof setContributorDefaultRateInputSchema>
export type ContributorDto = z.infer<typeof contributorDtoSchema>
