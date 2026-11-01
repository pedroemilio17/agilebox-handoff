import { z } from 'zod'
import { userSummaryDtoSchema } from './shared-schemas'
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

export const dashboardDtoSchema = z.object({
  distribution: taskStatusDistributionSchema,
  collaborators: z.array(collaboratorDashboardStatSchema),
})

export const getDashboardInputSchema = z.undefined()
export const getDashboardOutputSchema = dashboardDtoSchema

export const dashboardStatusSchema = taskStatusSchema

export type DashboardDto = z.infer<typeof dashboardDtoSchema>
