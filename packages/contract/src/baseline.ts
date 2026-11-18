import { z } from 'zod'
import { isoDateTimeSchema, ulidSchema } from './shared-schemas'

/** Data `YYYY-MM-DD`. O domínio valida o calendário. */
const dateSchema = z.iso.date()

/**
 * Situação da tarefa frente à foto: `late` = Atrasada, `on_time` = No prazo, `new` = Nova,
 * `removed` = Removida (regra em `core/rules/baseline.ts`).
 */
export const baselineStatusSchema = z.enum(['on_time', 'late', 'new', 'removed'])

/**
 * Desvio de uma tarefa. Dias: positivo = atrasou, negativo = adiantou. Horas em horas (não centésimos).
 * Custo em reais. Os campos de custo vêm nulos quando quem lê não é gestor ou o módulo `cost` está
 * desligado. Diferenças nulas quando falta um dos lados (tarefa nova ou removida).
 */
export const baselineTaskDtoSchema = z.object({
  taskId: ulidSchema,
  title: z.string().min(1),
  status: baselineStatusSchema,
  delayDays: z.number().int().nullable(),
  startDelayDays: z.number().int().nullable(),
  endDelayDays: z.number().int().nullable(),
  plannedStartsOn: dateSchema.nullable(),
  plannedEndsOn: dateSchema.nullable(),
  currentStartsOn: dateSchema.nullable(),
  currentEndsOn: dateSchema.nullable(),
  hoursDelta: z.number().nullable(),
  costDelta: z.number().nullable(),
})

/**
 * Resumo do projeto. `endDeviationDays` positivo = o fim atual está depois do planejado. Custos em
 * reais; nulos quando quem lê não é gestor ou o módulo `cost` está desligado.
 */
export const baselineSummaryDtoSchema = z.object({
  plannedEnd: dateSchema.nullable(),
  currentEnd: dateSchema.nullable(),
  endDeviationDays: z.number().int().nullable(),
  plannedHours: z.number().min(0),
  currentHours: z.number().min(0),
  plannedCost: z.number().nullable(),
  currentCost: z.number().nullable(),
})

/** Foto vigente (a mais recente). `takenByName` é nulo se o gravador não tem nome na organização. */
export const baselineDtoSchema = z.object({
  id: ulidSchema,
  name: z.string().min(1),
  takenAt: isoDateTimeSchema,
  takenByName: z.string().nullable(),
})

/**
 * Leitura da linha de base do projeto. `canTake` diz se a tela mostra "Tirar nova foto" (só o gestor,
 * com o projeto sem arquivar). `baseline` e `summary` são nulos sem nenhuma foto ainda.
 */
export const baselineViewDtoSchema = z.object({
  projectId: ulidSchema,
  canTake: z.boolean(),
  costEnabled: z.boolean(),
  /** Quem lê vê os valores de custo (gestor, com o módulo `cost` ligado). Diferencia "sem dado" de "sem permissão". */
  costVisible: z.boolean(),
  baseline: baselineDtoSchema.nullable(),
  summary: baselineSummaryDtoSchema.nullable(),
  tasks: z.array(baselineTaskDtoSchema),
})

export const getBaselineInputSchema = z.object({ projectId: ulidSchema })
export const getBaselineOutputSchema = baselineViewDtoSchema

export const takeBaselineInputSchema = z.object({ projectId: ulidSchema })
export const takeBaselineOutputSchema = baselineViewDtoSchema

export type BaselineStatus = z.infer<typeof baselineStatusSchema>
export type BaselineTaskDto = z.infer<typeof baselineTaskDtoSchema>
export type BaselineSummaryDto = z.infer<typeof baselineSummaryDtoSchema>
export type BaselineDto = z.infer<typeof baselineDtoSchema>
export type BaselineViewDto = z.infer<typeof baselineViewDtoSchema>
