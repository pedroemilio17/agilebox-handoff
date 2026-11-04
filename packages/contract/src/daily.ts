import { z } from 'zod'
import { isoDateTimeSchema, nameSchema, ulidSchema } from './shared-schemas'

const dateSchema = z.iso.date()

/** Limite de cada resposta da daily, em caracteres (igual ao core). */
export const DAILY_ANSWER_MAX_LENGTH = 500
const dailyAnswerSchema = z
  .string()
  .refine((value) => Array.from(value.trim()).length <= DAILY_ANSWER_MAX_LENGTH, {
    message: 'Resposta deve ter até 500 caracteres',
  })

/** Os três passos da daily, na ordem da bandeja. Vazio é permitido; o core exige ao menos um texto ou "sem novidades". */
export const dailyAnswersSchema = z.object({
  progress: dailyAnswerSchema,
  nextStep: dailyAnswerSchema,
  blocker: dailyAnswerSchema,
})

export const dailyEntryDtoSchema = z.object({
  id: ulidSchema,
  userId: ulidSchema,
  userName: nameSchema,
  date: dateSchema,
  answers: dailyAnswersSchema,
  noNews: z.boolean(),
  /** Ids das tarefas citadas. Quem lê a daily alheia (gestor) vê os mesmos ids. */
  taskRefs: z.array(ulidSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export const getTodayDailyInputSchema = z.object({ date: dateSchema })
export const getTodayDailyOutputSchema = z.object({
  date: dateSchema,
  /** Falso quando a pessoa já tem a daily da data. */
  due: z.boolean(),
  entry: dailyEntryDtoSchema.nullable(),
})

export const saveDailyInputSchema = z.object({
  date: dateSchema,
  /** Opcional: se vier, tem que ser a própria pessoa (senão FORBIDDEN). */
  userId: ulidSchema.optional(),
  answers: dailyAnswersSchema,
  noNews: z.boolean().default(false),
  taskRefs: z.array(ulidSchema).default([]),
})
export const saveDailyOutputSchema = dailyEntryDtoSchema

/** Uma linha do dashboard: pessoa da organização e se já tem daily na data. */
export const dailyStatusDtoSchema = z.object({
  userId: ulidSchema,
  userName: nameSchema,
  done: z.boolean(),
})
export const listDailyForDateInputSchema = z.object({ date: dateSchema })
export const listDailyForDateOutputSchema = z.array(dailyStatusDtoSchema)

export const getDailyForUserInputSchema = z.object({
  userId: ulidSchema,
  date: dateSchema,
})
export const getDailyForUserOutputSchema = dailyEntryDtoSchema.nullable()

export type DailyEntryDto = z.infer<typeof dailyEntryDtoSchema>
export type DailyAnswersDto = z.infer<typeof dailyAnswersSchema>
export type DailyStatusDto = z.infer<typeof dailyStatusDtoSchema>
export type DailyTodayDto = z.infer<typeof getTodayDailyOutputSchema>
