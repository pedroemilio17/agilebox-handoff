import { describe, expect, it } from 'vitest'
import { ConflictError, ValidationError } from '../shared/errors'
import type { OrganizationId, ProjectId, UserId } from '../shared/ids'
import { archiveProject, createProject, renameProject } from './project'

const org = 'org' as OrganizationId
const user = 'user' as UserId
const at = '2026-03-01T10:00:00.000Z'

function aProject(name = 'Projeto Aurora') {
  return createProject({
    id: 'project' as ProjectId,
    organizationId: org,
    name,
    createdBy: user,
    createdAt: '2026-01-01T00:00:00.000Z',
  })
}

describe('renomear projeto', () => {
  it('troca o nome, apara espaços e recalcula a chave de comparação', () => {
    const renamed = renameProject(aProject(), '  Gestão Ágil  ')
    expect(renamed.name).toBe('Gestão Ágil')
    expect(renamed.nameKey).toBe('gestao agil')
  })

  it('mantém id, organização, criador e data de criação', () => {
    const original = aProject()
    const renamed = renameProject(original, 'Outro nome')
    expect(renamed).toEqual({ ...original, name: 'Outro nome', nameKey: 'outro nome' })
  })

  it('recusa nome vazio ou só com espaços', () => {
    expect(() => renameProject(aProject(), '   ')).toThrow(ValidationError)
    expect(() => renameProject(aProject(), '')).toThrow('Nome obrigatório')
  })

  it('recusa renomear projeto arquivado, com conflito', () => {
    const archived = archiveProject(aProject(), user, at)
    expect(() => renameProject(archived, 'Novo nome')).toThrow(ConflictError)
    expect(() => renameProject(archived, 'Novo nome')).toThrow(
      'Desarquive o projeto antes de renomear',
    )
  })

  it('a criação e a renomeação usam a mesma chave para o mesmo nome', () => {
    const created = aProject('Gestão Ágil')
    const renamed = renameProject(aProject('Outro'), 'gestao   agil')
    expect(renamed.nameKey).toBe(created.nameKey)
  })
})
