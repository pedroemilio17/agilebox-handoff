import { z } from 'zod'
import { ulidSchema } from './shared-schemas'
import { teamModuleIdSchema, teamModuleStateSchema } from './team-tools'

/**
 * Módulos de cada projeto (ADR-10). Como em `team-tools.ts`, o id de módulo chega como texto e a
 * aplicação o valida contra o catálogo. Nível `null` só no núcleo.
 */
const MAX_MODULES_PER_REQUEST = 20

const moduleIdListSchema = z.array(teamModuleIdSchema).max(MAX_MODULES_PER_REQUEST)

export const getProjectModulesInputSchema = z.object({ projectId: ulidSchema })

/** Sem entrada: a leitura é da organização da pessoa que pede. */
export const getOrganizationModulesInputSchema = z.undefined()

export const changeProjectModulesInputSchema = z.object({
  projectId: ulidSchema,
  enable: moduleIdListSchema.optional(),
  disable: moduleIdListSchema.optional(),
})

/**
 * Configuração de um módulo neste projeto (ADR-10). O objeto é validado por módulo na aplicação,
 * nunca aqui. `{}` apaga a configuração do projeto e volta a herdar a da equipe.
 */
export const setProjectModuleConfigInputSchema = z.object({
  projectId: ulidSchema,
  moduleId: teamModuleIdSchema,
  config: z.record(z.string(), z.unknown()),
})

export const projectModuleLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.null(),
])

/** Um módulo do projeto: o que é (manifesto), como está e a configuração gravada, se houver. */
export const projectModuleDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: projectModuleLevelSchema,
  objective: z.string(),
  state: teamModuleStateSchema,
  requires: z.array(z.string()),
  enhances: z.array(z.string()),
  config: z.record(z.string(), z.unknown()).nullable(),
})

export const projectModulesViewDtoSchema = z.object({
  projectId: ulidSchema,
  modules: z.array(projectModuleDtoSchema),
  /** Só o gestor altera os módulos do projeto. */
  canManage: z.boolean(),
})

/**
 * Resultado de uma gravação: a lista nova e o que a regra ligou junto, desligou junto e deixou
 * agendado (com o motivo, como `active_sprint`). Nada agendado é gravado agora.
 */
export const projectModulesChangeResultDtoSchema = z.object({
  modules: z.array(projectModuleDtoSchema),
  autoEnabled: z.array(z.string()),
  cascadeDisabled: z.array(z.string()),
  scheduled: z.array(z.object({ moduleId: z.string(), reason: z.string() })),
})

/** Estado de um módulo na organização inteira (agregado dos projetos não arquivados). */
export const organizationModulesViewDtoSchema = z.object({
  modules: z.array(z.object({ id: teamModuleIdSchema, state: teamModuleStateSchema })),
  /** Há projeto não arquivado. Sem nenhum, a interface segue as ferramentas da equipe. */
  hasActiveProjects: z.boolean(),
})

export type GetProjectModulesInput = z.infer<typeof getProjectModulesInputSchema>
export type ChangeProjectModulesInput = z.infer<typeof changeProjectModulesInputSchema>
export type SetProjectModuleConfigInput = z.infer<typeof setProjectModuleConfigInputSchema>
export type ProjectModuleDto = z.infer<typeof projectModuleDtoSchema>
export type ProjectModulesViewDto = z.infer<typeof projectModulesViewDtoSchema>
export type ProjectModulesChangeResultDto = z.infer<typeof projectModulesChangeResultDtoSchema>
export type OrganizationModulesViewDto = z.infer<typeof organizationModulesViewDtoSchema>
