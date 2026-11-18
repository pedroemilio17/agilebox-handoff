import { z } from 'zod'
import { ulidSchema } from './shared-schemas'

/** Data `YYYY-MM-DD`. O domínio valida o calendário. */
const dateSchema = z.iso.date()

/**
 * Status do marco no acompanhamento: `done` = Cumprido, `at_risk` = Em risco, `on_track` = No prazo
 * (regra em `core/rules/tracking.ts`).
 */
export const trackingMilestoneStatusSchema = z.enum(['done', 'at_risk', 'on_track'])

/** Marco do acompanhamento. `deliverableTitle` só vem com o módulo `wbs` ligado no projeto. */
export const trackingMilestoneDtoSchema = z.object({
  id: ulidSchema,
  title: z.string().min(1),
  dueOn: dateSchema,
  criterion: z.string().nullable(),
  deliverableTitle: z.string().nullable(),
  status: trackingMilestoneStatusSchema,
})

/** Próximo marco: o de data mais próxima a partir de hoje que ainda não está cumprido. */
export const trackingNextMilestoneDtoSchema = z.object({
  id: ulidSchema,
  title: z.string().min(1),
  dueOn: dateSchema,
  daysLeft: z.number().int(),
  status: trackingMilestoneStatusSchema,
})

/**
 * Leitura do acompanhamento do projeto. Valores em reais; nulos quando quem lê não é gestor (só o
 * gestor vê custo). `week` é nulo sem intervalo de datas no cronograma.
 */
export const trackingViewDtoSchema = z.object({
  projectId: ulidSchema,
  week: z.object({ current: z.number().int().min(1), total: z.number().int().min(1) }).nullable(),
  summary: z.object({
    /** Concluído: horas estimadas das tarefas concluídas ÷ horas estimadas, de 0 a 100. */
    progress: z.number().int().min(0).max(100),
    plannedHours: z.number().min(0),
    loggedHours: z.number().min(0),
    realizedCost: z.number().nullable(),
    plannedCost: z.number().nullable(),
    tasks: z.object({ total: z.number().int().min(0), done: z.number().int().min(0) }),
  }),
  nextMilestone: trackingNextMilestoneDtoSchema.nullable(),
  milestones: z.array(trackingMilestoneDtoSchema),
  today: dateSchema,
})

export const getTrackingInputSchema = z.object({ projectId: ulidSchema })
export const getTrackingOutputSchema = trackingViewDtoSchema

export type TrackingMilestoneStatus = z.infer<typeof trackingMilestoneStatusSchema>
export type TrackingMilestoneDto = z.infer<typeof trackingMilestoneDtoSchema>
export type TrackingNextMilestoneDto = z.infer<typeof trackingNextMilestoneDtoSchema>
export type TrackingViewDto = z.infer<typeof trackingViewDtoSchema>
