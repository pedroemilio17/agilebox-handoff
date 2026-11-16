import { z } from 'zod'

/**
 * Ferramentas da equipe (PLANO-2.0). O contrato não importa o núcleo: o id de ferramenta chega como
 * texto e a aplicação o valida contra o catálogo (`toModuleId`), recusando o que não existe.
 */
const MODULE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9.]*$/
const MAX_MODULES_PER_REQUEST = 20

export const teamModuleIdSchema = z.string().min(1).max(40).regex(MODULE_ID_PATTERN)
export const teamPresetIdSchema = z.enum(['kanban', 'scrum', 'kanban-flow', 'scrum-complete'])
export const experienceLevelSchema = z.enum(['basic', 'intermediate', 'advanced'])
export const teamModuleStateSchema = z.enum(['active', 'winding_down', 'disabled'])

const moduleIdListSchema = z.array(teamModuleIdSchema).max(MAX_MODULES_PER_REQUEST)

/**
 * Entradas com campos extras (ex.: `userId`, `tenantId`) não são recusadas: o zod descarta o que não
 * está no schema, e o contexto vem só da sessão.
 */
export const getTeamToolsInputSchema = z.undefined()

export const teamToolsChangeInputSchema = z.object({
  enable: moduleIdListSchema.optional(),
  disable: moduleIdListSchema.optional(),
  finalize: moduleIdListSchema.optional(),
})

export const previewTeamToolsChangeInputSchema = z
  .object({
    enable: moduleIdListSchema.optional(),
    disable: moduleIdListSchema.optional(),
    finalize: moduleIdListSchema.optional(),
    presetId: teamPresetIdSchema.optional(),
  })
  .refine(
    (input) =>
      input.presetId === undefined ||
      (input.enable === undefined && input.disable === undefined && input.finalize === undefined),
    { message: 'Escolha um preset ou ajuste as ferramentas, não os dois' },
  )

export const applyTeamPresetInputSchema = z.object({
  presetId: teamPresetIdSchema,
  applySuggestedLevel: z.boolean().optional(),
})
export const setTeamLevelInputSchema = z.object({ level: experienceLevelSchema })
export const completeTeamWindDownInputSchema = z.object({ moduleId: teamModuleIdSchema })

export const teamToolDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  state: teamModuleStateSchema,
  minLevel: experienceLevelSchema,
})

export const teamPresetDtoSchema = z.object({
  id: teamPresetIdSchema,
  label: z.string(),
  modules: z.array(z.string()),
  suggestedLevel: experienceLevelSchema,
})

export const teamToolsViewDtoSchema = z.object({
  level: experienceLevelSchema,
  modules: z.array(teamToolDtoSchema),
  presets: z.array(teamPresetDtoSchema),
  /** `effectiveCapabilities` para o time e o papel de quem pede. */
  capabilities: z.array(z.string()),
  /** Ferramentas ativas acima do nível da equipe (aviso "Subir o nível do projeto?"). */
  levelWarnings: z.array(
    z.object({ module: z.string(), label: z.string(), requiredLevel: experienceLevelSchema }),
  ),
  canManage: z.boolean(),
})

/** Resultado de uma gravação: a visão nova e o que a regra ligou, encerrou ou desligou. */
export const teamToolsChangeResultDtoSchema = z.object({
  view: teamToolsViewDtoSchema,
  autoEnabled: z.array(z.string()),
  windingDown: z.array(z.string()),
  disabled: z.array(z.string()),
})

export const teamToolsImpactDtoSchema = z.object({
  module: z.string(),
  count: z.number().int().nonnegative().safe(),
  description: z.string(),
})

/** Prévia de uma mudança: nada é gravado. Quando `ok` é falso, `message` diz por quê. */
export const teamToolsPreviewDtoSchema = z.object({
  ok: z.boolean(),
  message: z.string().nullable(),
  autoEnabled: z.array(z.string()),
  activated: z.array(z.string()),
  windingDown: z.array(z.string()),
  disabled: z.array(z.string()),
  conflicts: z.array(z.tuple([z.string(), z.string()])),
  blockedBy: z.array(z.string()),
  dependents: z.array(z.object({ module: z.string(), requiredBy: z.array(z.string()) })),
  impact: z.array(teamToolsImpactDtoSchema),
})

export type TeamToolsChangeInput = z.infer<typeof teamToolsChangeInputSchema>
export type PreviewTeamToolsChangeInput = z.infer<typeof previewTeamToolsChangeInputSchema>
export type ApplyTeamPresetInput = z.infer<typeof applyTeamPresetInputSchema>
export type SetTeamLevelInput = z.infer<typeof setTeamLevelInputSchema>
export type CompleteTeamWindDownInput = z.infer<typeof completeTeamWindDownInputSchema>
export type TeamToolDto = z.infer<typeof teamToolDtoSchema>
export type TeamPresetDto = z.infer<typeof teamPresetDtoSchema>
export type TeamToolsViewDto = z.infer<typeof teamToolsViewDtoSchema>
export type TeamToolsChangeResultDto = z.infer<typeof teamToolsChangeResultDtoSchema>
export type TeamToolsImpactDto = z.infer<typeof teamToolsImpactDtoSchema>
export type TeamToolsPreviewDto = z.infer<typeof teamToolsPreviewDtoSchema>
