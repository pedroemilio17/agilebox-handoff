import { z } from 'zod'
import { isoDateTimeSchema, nameSchema, ulidSchema } from './shared-schemas'

const dateSchema = z.iso.date()
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u)
const monthSchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/u)
const participantsSchema = z.array(ulidSchema)

export const meetingDtoSchema = z.object({
  id: ulidSchema,
  title: nameSchema,
  date: dateSchema,
  time: timeSchema,
  participants: participantsSchema,
  createdBy: ulidSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export const listMeetingsInputSchema = z.object({ month: monthSchema })
export const listMeetingsOutputSchema = z.array(meetingDtoSchema)
export const listUpcomingMeetingsInputSchema = z.undefined()
export const listUpcomingMeetingsOutputSchema = listMeetingsOutputSchema

export const createMeetingInputSchema = z.object({
  title: nameSchema,
  date: dateSchema,
  time: timeSchema,
  participants: participantsSchema,
})
export const createMeetingOutputSchema = meetingDtoSchema

export const updateMeetingChangesSchema = z
  .object({
    title: nameSchema.optional(),
    date: dateSchema.optional(),
    time: timeSchema.optional(),
    participants: participantsSchema.optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0, 'Informe ao menos uma alteração')
export const updateMeetingInputSchema = z.object({
  meetingId: ulidSchema,
  changes: updateMeetingChangesSchema,
})
export const updateMeetingOutputSchema = meetingDtoSchema
export const deleteMeetingInputSchema = z.object({ meetingId: ulidSchema })
export const deleteMeetingOutputSchema = z.void()

export type MeetingDto = z.infer<typeof meetingDtoSchema>
export type CreateMeetingInput = z.infer<typeof createMeetingInputSchema>
export type UpdateMeetingInput = z.infer<typeof updateMeetingInputSchema>
