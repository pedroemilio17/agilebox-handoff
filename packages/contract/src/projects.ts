import { z } from 'zod'
import { isoDateTimeSchema, nameSchema, ulidSchema, userSummaryDtoSchema } from './shared-schemas'

export const listProjectsInputSchema = z
  .object({ includeArchived: z.boolean().optional() })
  .optional()
export const createProjectInputSchema = z.object({ name: nameSchema })
export const archiveProjectInputSchema = z.object({ projectId: ulidSchema })
export const unarchiveProjectInputSchema = archiveProjectInputSchema
export const renameProjectInputSchema = z.object({ projectId: ulidSchema, name: nameSchema })
export const listProjectMembersInputSchema = z.object({ projectId: ulidSchema })
export const addProjectMemberInputSchema = z.object({ projectId: ulidSchema, userId: ulidSchema })
export const removeProjectMemberInputSchema = addProjectMemberInputSchema

export const projectDtoSchema = z.object({
  id: ulidSchema,
  name: nameSchema,
  createdBy: ulidSchema,
  createdAt: isoDateTimeSchema,
})

export const listProjectsOutputSchema = z.array(projectDtoSchema)
export const createProjectOutputSchema = projectDtoSchema
export const archiveProjectOutputSchema = z.void()
export const unarchiveProjectOutputSchema = archiveProjectOutputSchema
export const renameProjectOutputSchema = projectDtoSchema
export const listProjectMembersOutputSchema = z.array(userSummaryDtoSchema)
export const addProjectMemberOutputSchema = z.void()
export const removeProjectMemberOutputSchema = z.void()

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>
export type AddProjectMemberInput = z.infer<typeof addProjectMemberInputSchema>
export type RemoveProjectMemberInput = z.infer<typeof removeProjectMemberInputSchema>
export type ProjectDto = z.infer<typeof projectDtoSchema>
