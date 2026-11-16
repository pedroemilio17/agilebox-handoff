import { ConflictError } from '../shared/errors'
import type { OrganizationId, ProjectId, UserId } from '../shared/ids'
import { validateName } from './validation'

export interface Project {
  readonly id: ProjectId
  readonly organizationId: OrganizationId
  readonly name: string
  readonly nameKey: string
  readonly createdBy: UserId
  readonly createdAt: string
  /** Projeto arquivado some das listas padrão e não aceita tarefas novas. Nulos quando ativo. */
  readonly archivedAt: string | null
  readonly archivedBy: UserId | null
}

export function createProject(
  input: Omit<Project, 'nameKey' | 'archivedAt' | 'archivedBy'>,
): Project {
  const name = validateName(input.name)
  const nameKey = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/gu, ' ')
  return {
    id: input.id,
    organizationId: input.organizationId,
    name,
    nameKey,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    archivedAt: null,
    archivedBy: null,
  }
}

export function archiveProject(project: Project, by: UserId, at: string): Project {
  if (project.archivedAt !== null) throw new ConflictError('Projeto já está arquivado')
  return { ...project, archivedAt: at, archivedBy: by }
}

export function unarchiveProject(project: Project): Project {
  if (project.archivedAt === null) throw new ConflictError('Projeto não está arquivado')
  return { ...project, archivedAt: null, archivedBy: null }
}
