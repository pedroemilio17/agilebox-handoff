import { z } from 'zod'
import { userSummaryDtoSchema } from './shared-schemas'
import { isoDateTimeSchema, ulidSchema } from './shared-schemas'
import { taskStatusSchema } from './tasks'

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
  upToDatePercentage: z.number().min(0).max(100).nullable(),
  agingCount: z.number().int().nonnegative(),
  overdueCount: z.number().int().nonnegative(),
  blockedCount: z.number().int().nonnegative(),
  cycleDays: z.number().nonnegative().nullable(),
  leadDays: z.number().nonnegative().nullable(),
  throughput: z.number().int().nonnegative(),
  weeks: z.array(
    z.object({
      start: z.iso.date(),
      throughput: z.number().int().nonnegative(),
      cycleDays: z.number().nonnegative().nullable().optional(),
      leadDays: z.number().nonnegative().nullable().optional(),
      upToDatePercentage: z.number().min(0).max(100).nullable().optional(),
    }),
  ),
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
      inProgress: z.number().int().nonnegative(),
      agingCount: z.number().int().nonnegative(),
      overdueCount: z.number().int().nonnegative(),
      blockedCount: z.number().int().nonnegative(),
      lastUpdatedAt: isoDateTimeSchema.nullable(),
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

export type DashboardDto = z.infer<typeof dashboardDtoSchema>
