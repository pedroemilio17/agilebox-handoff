import { z } from 'zod'
import { isoDateTimeSchema, nameSchema, ulidSchema } from './shared-schemas'

const dateSchema = z.iso.date()
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u)
const participantsSchema = z.array(ulidSchema)
const kindSchema = z.enum(['meeting', 'review', 'retro'])
const recurrenceSchema = z.enum(['none', 'weekly'])

/** Intervalo de datas consultado pela agenda: no máximo 400 dias. */
const MAX_RANGE_DAYS = 400

export const meetingDtoSchema = z.object({
  id: ulidSchema,
  title: nameSchema,
  /** Data de início da série (ou do agendamento avulso). */
  date: dateSchema,
  time: timeSchema,
  endTime: timeSchema.nullable(),
  kind: kindSchema,
  recurrence: recurrenceSchema,
  recurrenceUntil: dateSchema.nullable(),
  participants: participantsSchema,
  createdBy: ulidSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

/** Uma ocorrência expandida: os dados do agendamento mais a posição na série. */
export const meetingOccurrenceDtoSchema = meetingDtoSchema.extend({
  seriesId: ulidSchema,
  occurrenceDate: dateSchema,
  occurrenceIndex: z.number().int().nonnegative(),
  /** Hora de fim efetiva: o fim informado ou início + 1 hora. */
  occurrenceEndTime: timeSchema,
})

export const listMeetingsInputSchema = z
  .object({ rangeStart: dateSchema, rangeEnd: dateSchema })
  .refine(({ rangeStart, rangeEnd }) => rangeStart <= rangeEnd, 'Intervalo de datas inválido')
  .refine(
    ({ rangeStart, rangeEnd }) =>
      Date.parse(`${rangeEnd}T00:00:00Z`) - Date.parse(`${rangeStart}T00:00:00Z`) <=
      MAX_RANGE_DAYS * 86_400_000,
    'Intervalo de datas grande demais',
  )
export const listMeetingsOutputSchema = z.array(meetingOccurrenceDtoSchema)
export const listUpcomingMeetingsInputSchema = z.undefined()
export const listUpcomingMeetingsOutputSchema = listMeetingsOutputSchema

export const createMeetingInputSchema = z.object({
  title: nameSchema,
  date: dateSchema,
  time: timeSchema,
  endTime: timeSchema.nullable().optional(),
  kind: kindSchema.optional(),
  recurrence: recurrenceSchema.optional(),
  recurrenceUntil: dateSchema.nullable().optional(),
  participants: participantsSchema,
})
export const createMeetingOutputSchema = meetingDtoSchema

export const updateMeetingChangesSchema = z
  .object({
    title: nameSchema.optional(),
    date: dateSchema.optional(),
    time: timeSchema.optional(),
    endTime: timeSchema.nullable().optional(),
    kind: kindSchema.optional(),
    recurrence: recurrenceSchema.optional(),
    recurrenceUntil: dateSchema.nullable().optional(),
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
export type MeetingOccurrenceDto = z.infer<typeof meetingOccurrenceDtoSchema>
export type CreateMeetingInput = z.infer<typeof createMeetingInputSchema>
export type UpdateMeetingInput = z.infer<typeof updateMeetingInputSchema>
