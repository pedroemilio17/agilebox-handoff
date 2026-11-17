import { z } from 'zod'
import { isoDateTimeSchema, nameSchema, ulidSchema, userSummaryDtoSchema } from './shared-schemas'

/** Padrão: projetos arquivados ficam de fora. `includeArchived` mostra todos. */
export const listProjectsInputSchema = z
  .object({ includeArchived: z.boolean().optional() })
  .optional()
export const createProjectInputSchema = z.object({ name: nameSchema })

/** Enums do assistente de criação (ADR-10), iguais aos de `WizardAnswers` no domínio. */
export const projectPresetKeySchema = z.enum([
  'simples',
  'kanban',
  'agil',
  'tradicional',
  'hibrido',
])
export const guideLevelSchema = z.enum(['never', 'sometimes', 'always'])
export const wizardAnswersSchema = z.object({
  workType: z.enum(['finite', 'continuous', 'unknown']).optional(),
  fixedDate: z.enum(['yes', 'no', 'unknown']).optional(),
  scope: z.enum(['defined', 'partly', 'will_change', 'unknown']).optional(),
  outsiderFollows: z.enum(['yes', 'no']).optional(),
  controlsHoursAndCost: z.enum(['yes', 'no']).optional(),
  experience: z.enum(['never', 'sometimes', 'always']).optional(),
})
const MAX_SETUP_MODULES = 20

/**
 * Criação com o assistente (ADR-10): só o nome é obrigatório. Sem respostas, sem módulos e sem
 * preset, o projeto nasce Simples. `modules` são ids do catálogo; a aplicação valida e traz as
 * dependências.
 */
export const createProjectWithSetupInputSchema = z.object({
  name: nameSchema,
  answers: wizardAnswersSchema.optional(),
  startedFromPreset: projectPresetKeySchema.optional(),
  modules: z.array(z.string().min(1).max(40)).max(MAX_SETUP_MODULES).optional(),
  guideLevel: guideLevelSchema.optional(),
})
export const listProjectMembersInputSchema = z.object({ projectId: ulidSchema })
export const addProjectMemberInputSchema = z.object({ projectId: ulidSchema, userId: ulidSchema })
export const removeProjectMemberInputSchema = addProjectMemberInputSchema
export const archiveProjectInputSchema = z.object({ projectId: ulidSchema })
export const unarchiveProjectInputSchema = archiveProjectInputSchema
export const renameProjectInputSchema = z.object({ projectId: ulidSchema, name: nameSchema })

export const projectDtoSchema = z.object({
  id: ulidSchema,
  name: nameSchema,
  createdBy: ulidSchema,
  createdAt: isoDateTimeSchema,
  /** Nulo quando ativo. Ausente em respostas antigas: tratar como ativo. */
  archivedAt: isoDateTimeSchema.nullable().optional(),
  /** Quantos itens a definição de pronto tem (0 = conclusão sem conferência). */
  definitionOfDoneCount: z.number().int().nonnegative().safe(),
})

export const listProjectsOutputSchema = z.array(projectDtoSchema)
export const createProjectOutputSchema = projectDtoSchema
/** Projeto criado com o assistente: os ids dos módulos ligados (com `core`) e o preset de partida. */
export const createProjectWithSetupOutputSchema = projectDtoSchema.extend({
  modules: z.array(z.string()),
  startedFromPreset: projectPresetKeySchema.nullable(),
})
export const listProjectMembersOutputSchema = z.array(userSummaryDtoSchema)
export const addProjectMemberOutputSchema = z.void()
export const removeProjectMemberOutputSchema = z.void()
export const archiveProjectOutputSchema = projectDtoSchema
export const unarchiveProjectOutputSchema = projectDtoSchema
export const renameProjectOutputSchema = projectDtoSchema

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>
export type CreateProjectWithSetupInput = z.infer<typeof createProjectWithSetupInputSchema>
export type ProjectWithSetupDto = z.infer<typeof createProjectWithSetupOutputSchema>
export type RenameProjectInput = z.infer<typeof renameProjectInputSchema>
export type AddProjectMemberInput = z.infer<typeof addProjectMemberInputSchema>
export type RemoveProjectMemberInput = z.infer<typeof removeProjectMemberInputSchema>
export type ProjectDto = z.infer<typeof projectDtoSchema>
