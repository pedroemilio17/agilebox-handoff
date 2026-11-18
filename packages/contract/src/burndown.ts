import { z } from 'zod'
import { ulidSchema } from './shared-schemas'

/** Data `YYYY-MM-DD`. O domínio valida o calendário. */
const dateSchema = z.iso.date()

/** Sprint mostrada no burndown: a ativa, ou a última encerrada quando não há ativa. */
export const burndownSprintDtoSchema = z.object({
  id: ulidSchema,
  number: z.number().int().min(1),
  name: z.string().min(1),
  status: z.enum(['active', 'closed']),
  plannedStart: dateSchema,
  plannedEnd: dateSchema,
})

/** Um dia da sprint. `remainingHours` é nulo nos dias ainda não medidos (futuros). */
export const burndownDayDtoSchema = z.object({
  date: dateSchema,
  idealHours: z.number().min(0),
  remainingHours: z.number().min(0).nullable(),
})

/** Velocidade de uma sprint encerrada: horas estimadas concluídas até o encerramento. */
export const velocitySprintDtoSchema = z.object({
  sprintId: ulidSchema,
  number: z.number().int().min(1),
  name: z.string().min(1),
  hours: z.number().min(0),
})

/**
 * Leitura do burndown do projeto. Só horas e contagens, sem valores de custo. `sprint` é nulo sem
 * sprint ativa nem encerrada; `days` e os números de sprint vêm vazios nesse caso.
 */
export const burndownViewDtoSchema = z.object({
  projectId: ulidSchema,
  today: dateSchema,
  sprint: burndownSprintDtoSchema.nullable(),
  totalHours: z.number().min(0),
  remainingHours: z.number().min(0),
  scopeTasks: z.number().int().min(0),
  doneTasks: z.number().int().min(0),
  unestimatedTasks: z.number().int().min(0),
  days: z.array(burndownDayDtoSchema),
  velocity: z.object({
    /** Média das últimas sprints encerradas (até três). Nula sem sprint encerrada. */
    average: z.number().min(0).nullable(),
    /** Últimas sprints encerradas usadas na média, da mais antiga para a mais recente. */
    sprints: z.array(velocitySprintDtoSchema),
  }),
})

export const getBurndownInputSchema = z.object({ projectId: ulidSchema })
export const getBurndownOutputSchema = burndownViewDtoSchema

export type BurndownSprintDto = z.infer<typeof burndownSprintDtoSchema>
export type BurndownDayDto = z.infer<typeof burndownDayDtoSchema>
export type VelocitySprintDto = z.infer<typeof velocitySprintDtoSchema>
export type BurndownViewDto = z.infer<typeof burndownViewDtoSchema>
