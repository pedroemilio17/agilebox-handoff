import { describe, expect, it } from 'vitest'
import {
  addProjectMemberInputSchema,
  createProjectInputSchema,
  createProjectOutputSchema,
  listProjectMembersOutputSchema,
  listProjectMembersInputSchema,
  listProjectsOutputSchema,
  removeProjectMemberInputSchema,
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
