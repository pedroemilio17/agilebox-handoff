import { z } from 'zod'
import { ulidSchema } from './shared-schemas'

/** Data `YYYY-MM-DD`. O domínio valida o calendário. */
const dateSchema = z.iso.date()

/** Uma semana da série: tarefas do projeto concluídas nela (cada tarefa conta na semana da última conclusão). */
export const flowMetricsWeekDtoSchema = z.object({
  start: dateSchema,
  completed: z.number().int().min(0),
})

/**
 * Métricas de fluxo do projeto (módulo `flowMetrics`): lead time, cycle time e vazão calculados da
 * linha do tempo, nas últimas oito semanas. Só contagens e dias, sem valores de custo.
 */
export const flowMetricsViewDtoSchema = z.object({
  projectId: ulidSchema,
  today: dateSchema,
  /** Primeira segunda da janela e fim (exclusivo) da última semana. */
  windowStart: dateSchema,
  windowEnd: dateSchema,
  /** Média de dias entre a criação e a conclusão. Nula sem tarefa concluída na janela. */
  leadDays: z.number().min(0).nullable(),
  /** Média de dias entre o primeiro início e a conclusão. Nula sem tarefa concluída com início. */
  cycleDays: z.number().min(0).nullable(),
  /** Tarefas concluídas na janela, cada uma contada uma vez. */
  completed: z.number().int().min(0),
  weeks: z.array(flowMetricsWeekDtoSchema),
})

export const getFlowMetricsInputSchema = z.object({ projectId: ulidSchema })
export const getFlowMetricsOutputSchema = flowMetricsViewDtoSchema

export type FlowMetricsWeekDto = z.infer<typeof flowMetricsWeekDtoSchema>
export type FlowMetricsViewDto = z.infer<typeof flowMetricsViewDtoSchema>
