import { z } from 'zod'
import { userSummaryDtoSchema } from './shared-schemas'
import { isoDateTimeSchema, ulidSchema } from './shared-schemas'
import { projectPresetKeySchema } from './projects'
import { taskStatusSchema } from './tasks'

/** Data `AAAA-MM-DD`. */
const dateOnlySchema = z.iso.date()
/** Contagem não negativa e inteira. */
const countSchema = z.number().int().nonnegative()

/** Indicador principal do cartão do projeto. A forma depende da metodologia (ou do que o projeto tem). */
export const dashboardSprintSummarySchema = z.object({
  number: z.number().int().min(1),
  day: z.number().int().min(1),
  totalDays: z.number().int().min(1),
  remainingHours: z.number().min(0),
  endsOn: dateOnlySchema,
})
export const dashboardKpiSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('sprint'), sprint: dashboardSprintSummarySchema }),
  z.object({
    kind: z.literal('progress'),
    /** Concluído: horas estimadas (acompanhamento) ou contagem de tarefas, de 0 a 100. */
    percent: z.number().int().min(0).max(100),
    done: countSchema,
    total: countSchema,
    /** Semana do cronograma, quando o projeto tem módulo `schedule`. */
    week: z.object({ current: z.number().int().min(1), total: z.number().int().min(1) }).nullable(),
    /** Custo realizado em reais: nulo sem módulo `cost` ou para quem não é gestor. */
    spentCost: z.number().nullable(),
    /** Dias de atraso (positivo) ou adiantamento (negativo) do fim frente à linha de base; nulo sem foto. */
    baselineDeviationDays: z.number().int().nullable(),
  }),
  z.object({
    kind: z.literal('milestone'),
    title: z.string().min(1),
    daysLeft: z.number().int(),
    percent: z.number().int().min(0).max(100),
    sprint: dashboardSprintSummarySchema.nullable(),
  }),
  z.object({
    kind: z.literal('flow'),
    leadDays: z.number().min(0).nullable(),
    completedLastWeek: countSchema,
  }),
])

export const dashboardProjectSchema = z.object({
  id: ulidSchema,
  name: z.string().min(1),
  /** Preset em que o projeto começou ("começou como"); nulo sem assistente. */
  method: projectPresetKeySchema.nullable(),
  /** Resumo em Em dia, Atenção ou Risco, com o motivo (regra provisória em `core/rules/dashboard-health.ts`). */
  health: z.enum(['ok', 'attention', 'risk']),
  healthReason: z.string().min(1),
  kpi: dashboardKpiSchema,
  /** Série do gráfico pequeno: referência (linha tracejada) e real. Nula quando o projeto não tem série. */
  trend: z
    .object({
      reference: z.array(z.number().min(0)).nullable(),
      actual: z.array(z.number().min(0).nullable()),
    })
    .nullable(),
})

/** Item de "Precisa de você": só sinais que o domínio já calcula. */
export const dashboardNeedSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['wip', 'milestone', 'acceptance']),
  projectId: ulidSchema,
  projectName: z.string().min(1),
  taskId: ulidSchema.nullable(),
  text: z.string().min(1),
  /** Quando o sinal aconteceu (último evento relevante); nulo quando o dado não tem hora. */
  at: isoDateTimeSchema.nullable(),
})

/** Movimento da linha do tempo (Atualizações). `category` agrupa para o filtro de tipo. */
export const dashboardUpdateSchema = z.object({
  id: ulidSchema,
  taskId: ulidSchema,
  taskTitle: z.string(),
  projectId: ulidSchema,
  projectName: z.string().min(1),
  projectMethod: projectPresetKeySchema.nullable(),
  actorUserId: ulidSchema,
  actorName: z.string(),
  asManager: z.boolean(),
  at: isoDateTimeSchema,
  category: z.enum(['status', 'estimate', 'deadline', 'comment', 'other']),
  text: z.string(),
})

export const taskStatusDistributionSchema = z
  .object({
    planning: z.number().int().min(0).max(100),
    todo: z.number().int().min(0).max(100),
    in_progress: z.number().int().min(0).max(100),
    review: z.number().int().min(0).max(100),
    done: z.number().int().min(0).max(100),
  })
  .refine((distribution) => {
    const total = Object.values(distribution).reduce((sum, percentage) => sum + percentage, 0)
    return total === 0 || total === 100
  }, 'A distribuição deve somar 100% ou ser zero')

export const collaboratorDashboardStatSchema = z.object({
  user: userSummaryDtoSchema,
  taskCount: z.number().int().nonnegative(),
  distribution: taskStatusDistributionSchema,
  completedPercentage: z.number().int().min(0).max(100),
})

export const dashboardInsightsSchema = z.object({
  updatedAt: isoDateTimeSchema,
  weekStart: z.iso.date(),
  /** Campos de fluxo (adesão, ciclo, lead time, vazão e semanas): ausentes com `flowMetrics` desligado. */
  upToDatePercentage: z.number().min(0).max(100).nullable().optional(),
  agingCount: z.number().int().nonnegative(),
  overdueCount: z.number().int().nonnegative(),
  blockedCount: z.number().int().nonnegative(),
  /** Colunas de WIP acima do limite, considerando todas as tarefas da organização. */
  overWipColumns: z.array(
    z.object({
      status: taskStatusSchema,
      count: z.number().int().nonnegative(),
      limit: z.number().int().positive(),
    }),
  ),
  cycleDays: z.number().nonnegative().nullable().optional(),
  leadDays: z.number().nonnegative().nullable().optional(),
  throughput: z.number().int().nonnegative().optional(),
  weeks: z
    .array(
      z.object({
        start: z.iso.date(),
        throughput: z.number().int().nonnegative(),
        cycleDays: z.number().nonnegative().nullable().optional(),
        leadDays: z.number().nonnegative().nullable().optional(),
        upToDatePercentage: z.number().min(0).max(100).nullable().optional(),
      }),
    )
    .optional(),
  /** Cartões dos projetos ativos (todos os visíveis ao gestor). */
  projects: z.array(dashboardProjectSchema),
  /** "Precisa de você": sinais de WIP, marco em risco e aceite pendente de todos os projetos. */
  needs: z.array(dashboardNeedSchema),
  /** Linha do tempo dos últimos sete dias (tela Atualizações), da mais recente para a mais antiga. */
  updates: z.array(dashboardUpdateSchema),
  recentChanges: z.array(
    z.object({
      id: ulidSchema,
      taskId: ulidSchema,
      taskTitle: z.string(),
      actorUserId: ulidSchema,
      actorName: z.string(),
      at: isoDateTimeSchema,
      text: z.string(),
      asManager: z.boolean(),
    }),
  ),
  team: z.array(
    z.object({
      user: userSummaryDtoSchema,
      /** Tarefas de que a pessoa participa (itens do resumo exportado). */
      taskCount: z.number().int().nonnegative(),
      completedPercentage: z.number().int().min(0).max(100),
      inProgress: z.number().int().nonnegative(),
      agingCount: z.number().int().nonnegative(),
      overdueCount: z.number().int().nonnegative(),
      blockedCount: z.number().int().nonnegative(),
      lastUpdatedAt: isoDateTimeSchema.nullable(),
      /** Projetos ativos em que a pessoa participa (chips da tabela). */
      projects: z.array(z.object({ id: ulidSchema, name: z.string().min(1) })),
      /** Maior número de dias parada entre as tarefas dela; nulo sem tarefa parada. */
      staleDays: countSchema.nullable(),
      /** Maior número de dias vencida entre as tarefas dela; nulo sem tarefa vencida. */
      overdueDays: countSchema.nullable(),
      /** Tarefas concluídas em que ela participa com critério de aceite pendente. */
      acceptancePendingCount: countSchema,
      /** Estimativa das tarefas abertas em que ela participa, em horas. */
      loadHours: z.number().min(0),
    }),
  ),
})

export const dashboardDtoSchema = z.object({
  insights: dashboardInsightsSchema.optional(),
  distribution: taskStatusDistributionSchema,
  collaborators: z.array(collaboratorDashboardStatSchema),
})

export const getDashboardInputSchema = z.undefined()
export const getDashboardOutputSchema = dashboardDtoSchema

export const dashboardStatusSchema = taskStatusSchema

/** Formato do resumo exportado: Markdown ou planilha CSV (B11). */
export const dashboardSummaryFormatSchema = z.enum(['md', 'csv'])
export const exportDashboardSummaryInputSchema = z.object({
  /** Início da semana escolhida no dashboard (segunda-feira, AAAA-MM-DD). */
  period: z.iso.date(),
  format: dashboardSummaryFormatSchema,
})
export const exportDashboardSummaryOutputSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  content: z.string(),
})
export const saveDashboardSummaryInputSchema = exportDashboardSummaryInputSchema
export const saveDashboardSummaryOutputSchema = z.object({ saved: z.boolean() })

export type DashboardDto = z.infer<typeof dashboardDtoSchema>
export type DashboardSummaryFormat = z.infer<typeof dashboardSummaryFormatSchema>
export type ExportDashboardSummaryInput = z.infer<typeof exportDashboardSummaryInputSchema>
export type ExportDashboardSummaryOutput = z.infer<typeof exportDashboardSummaryOutputSchema>
export type SaveDashboardSummaryInput = z.infer<typeof saveDashboardSummaryInputSchema>
export type SaveDashboardSummaryOutput = z.infer<typeof saveDashboardSummaryOutputSchema>
