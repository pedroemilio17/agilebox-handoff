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

/** Espelha `EXPERIENCE_LEVELS` do core. Coberto pelo teste de igualdade em `register-handlers.test.ts`. */
export const EXPERIENCE_LEVEL_IDS = ['basic', 'intermediate', 'advanced'] as const

/** Espelha `SIDEBAR_SCREEN_IDS` do core, na mesma ordem. Mesmo teste de igualdade. */
export const SIDEBAR_SCREEN_IDS = [
  'projects',
  'agenda',
  'backlog',
  'sprints',
  'dashboard',
  'impediments',
  'integrations',
  'tools',
] as const

export const experienceLevelSchema = z.enum(EXPERIENCE_LEVEL_IDS)
export const sidebarScreenIdSchema = z.enum(SIDEBAR_SCREEN_IDS)

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
/** Nível e telas do menu de quem pede (já filtradas por nível, módulo ligado e papel), mais os estados. */
export const getTeamModulesOutputSchema = z.object({
  level: experienceLevelSchema,
  screens: z.array(sidebarScreenIdSchema),
  statuses: z.array(teamModuleStatusDtoSchema),
})

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
export type TeamCapabilitiesDto = z.infer<typeof getTeamModulesOutputSchema>
export type SidebarScreenId = z.infer<typeof sidebarScreenIdSchema>
