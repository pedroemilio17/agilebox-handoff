import { describe, expect, it } from 'vitest'
import {
  addProjectMemberInputSchema,
  archiveProjectInputSchema,
  archiveProjectOutputSchema,
  createProjectInputSchema,
  createProjectOutputSchema,
  listProjectMembersOutputSchema,
  listProjectMembersInputSchema,
  listProjectsInputSchema,
  listProjectsOutputSchema,
  removeProjectMemberInputSchema,
  renameProjectInputSchema,
  renameProjectOutputSchema,
  unarchiveProjectInputSchema,
} from './projects'

const projectId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

describe('schemas de projetos', () => {
  it('aceita criação e retorno de projeto', () => {
    expect(createProjectInputSchema.parse({ name: 'Projeto Ágil' })).toEqual({
      name: 'Projeto Ágil',
    })
    const project = {
      id: projectId,
      name: 'Projeto Ágil',
      createdBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
      createdAt: '2026-10-31T12:00:00.000Z',
    }
    expect(createProjectOutputSchema.parse(project)).toEqual(project)
    expect(listProjectsOutputSchema.parse([project])).toEqual([project])
  })

  it('rejeita nome vazio e identificador de projeto inválido', () => {
    expect(createProjectInputSchema.safeParse({ name: '  ' }).success).toBe(false)
    expect(listProjectMembersInputSchema.safeParse({ projectId: 'project-1' }).success).toBe(false)
  })

  it('aceita inclusão e remoção de membro com identificadores válidos', () => {
    expect(addProjectMemberInputSchema.parse({ projectId, userId })).toEqual({ projectId, userId })
    expect(removeProjectMemberInputSchema.parse({ projectId, userId })).toEqual({
      projectId,
      userId,
    })
  })

  it('aceita listagem com e sem arquivados e rejeita flag inválida', () => {
    expect(listProjectsInputSchema.parse(undefined)).toBeUndefined()
    expect(listProjectsInputSchema.parse({ includeArchived: true })).toEqual({
      includeArchived: true,
    })
    expect(listProjectsInputSchema.safeParse({ includeArchived: 'sim' }).success).toBe(false)
  })

  it('aceita arquivar, desarquivar e renomear com identificador válido', () => {
    expect(archiveProjectInputSchema.parse({ projectId })).toEqual({ projectId })
    expect(unarchiveProjectInputSchema.parse({ projectId })).toEqual({ projectId })
    expect(archiveProjectOutputSchema.parse(undefined)).toBeUndefined()
    expect(renameProjectInputSchema.parse({ projectId, name: '  Novo nome  ' })).toEqual({
      projectId,
      name: 'Novo nome',
    })
    expect(
      renameProjectOutputSchema.parse({
        id: projectId,
        name: 'Novo nome',
        createdBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
        createdAt: '2026-10-31T12:00:00.000Z',
      }).name,
    ).toBe('Novo nome')
  })

  it('rejeita renomear com nome vazio e arquivar sem id válido', () => {
    expect(renameProjectInputSchema.safeParse({ projectId, name: '   ' }).success).toBe(false)
    expect(renameProjectInputSchema.safeParse({ projectId: 'project-1', name: 'X' }).success).toBe(
      false,
    )
    expect(archiveProjectInputSchema.safeParse({}).success).toBe(false)
    expect(archiveProjectInputSchema.safeParse({ projectId: 'project-1' }).success).toBe(false)
    expect(unarchiveProjectInputSchema.safeParse({ projectId: 'project-1' }).success).toBe(false)
  })

  it('aceita membros do projeto e rejeita papel inválido', () => {
    const member = { id: userId, name: 'Ana Lima', initials: 'AL', role: 'manager' }
    expect(listProjectMembersOutputSchema.parse([member])).toEqual([member])
    expect(listProjectMembersOutputSchema.safeParse([{ ...member, role: 'admin' }]).success).toBe(
      false,
    )
    expect(
      createProjectOutputSchema.safeParse({
        id: projectId,
        name: 'Projeto Ágil',
        createdAt: 'data inválida',
      }).success,
    ).toBe(false)
  })
})
