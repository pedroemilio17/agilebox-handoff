import { z } from 'zod'
import { isoDateTimeSchema, nameSchema, ulidSchema, userSummaryDtoSchema } from './shared-schemas'

/** Padrão: projetos arquivados ficam de fora. `includeArchived` mostra todos. */
export const listProjectsInputSchema = z
  .object({ includeArchived: z.boolean().optional() })
  .optional()
export const createProjectInputSchema = z.object({ name: nameSchema })
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
export const listProjectMembersOutputSchema = z.array(userSummaryDtoSchema)
export const addProjectMemberOutputSchema = z.void()
export const removeProjectMemberOutputSchema = z.void()
export const archiveProjectOutputSchema = projectDtoSchema
export const unarchiveProjectOutputSchema = projectDtoSchema
export const renameProjectOutputSchema = projectDtoSchema

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>
export type RenameProjectInput = z.infer<typeof renameProjectInputSchema>
export type AddProjectMemberInput = z.infer<typeof addProjectMemberInputSchema>
export type RemoveProjectMemberInput = z.infer<typeof removeProjectMemberInputSchema>
export type ProjectDto = z.infer<typeof projectDtoSchema>
