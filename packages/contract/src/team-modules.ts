import { z } from 'zod'

/**
 * Ids do catálogo de ferramentas. O contrato não importa `core` (PLANO 3.1), então a lista
 * espelha `MODULE_IDS` de `packages/core/src/modules/types.ts`. Um teste em
 * `apps/desktop/src/main/ipc/register-handlers.test.ts` garante que as duas listas são iguais.
 */
export const TEAM_MODULE_IDS = [
  'core',
  'agenda',
  'backlog',
  'sprints',
  'checkins',
  'impediments',
  'estimates.hours',
  'estimates.points',
  'acceptance',
  'wip',
  'subtasks',
  'integrations',
  'flowMetrics',
  'reviewRetro',
  'burndown',
] as const

export const teamModuleIdSchema = z.enum(TEAM_MODULE_IDS)
export const teamModuleStateSchema = z.enum(['active', 'winding_down', 'disabled'])
export const teamModuleItemKindSchema = z.enum(['tasks', 'meetings'])
export const teamModuleDestinationSchema = z.enum(['board', 'hidden'])

const countSchema = z.number().int().nonnegative()

export const teamModuleStatusDtoSchema = z.object({
  moduleId: teamModuleIdSchema,
  state: teamModuleStateSchema,
})

export const teamModuleImpactDtoSchema = z.object({
  moduleId: teamModuleIdSchema,
  counts: z.object({
    tasks: countSchema,
    projects: countSchema,
    participations: countSchema,
    meetings: countSchema,
  }),
  items: z.array(
    z.object({
      kind: teamModuleItemKindSchema,
      destination: teamModuleDestinationSchema,
      count: countSchema,
    }),
  ),
})

export const getTeamModulesInputSchema = z.undefined()
export const getTeamModulesOutputSchema = z.array(teamModuleStatusDtoSchema)

export const previewTeamModuleImpactInputSchema = z.object({
  disable: z.array(teamModuleIdSchema).optional(),
})
export const previewTeamModuleImpactOutputSchema = z.array(teamModuleImpactDtoSchema)

export const changeTeamModulesInputSchema = z.object({
  enable: z.array(teamModuleIdSchema).optional(),
  disable: z.array(teamModuleIdSchema).optional(),
})
export const changeTeamModulesOutputSchema = z.object({
  statuses: z.array(teamModuleStatusDtoSchema),
  windingDown: z.array(teamModuleImpactDtoSchema),
})

export const finishTeamModuleWindingDownInputSchema = z.object({
  moduleId: teamModuleIdSchema,
})
export const finishTeamModuleWindingDownOutputSchema = z.array(teamModuleStatusDtoSchema)

export type TeamModuleStatusDto = z.infer<typeof teamModuleStatusDtoSchema>
export type TeamModuleImpactDto = z.infer<typeof teamModuleImpactDtoSchema>
