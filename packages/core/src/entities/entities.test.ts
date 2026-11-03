import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toContributorId, toOrganizationId, toProjectId, toUserId } from '../shared/ids'
import { createOrganization } from './organization'
import { createUser } from './user'
import { createContributor } from './contributor'
import { createProject } from './project'

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const organizationId = toOrganizationId(id)
const userId = toUserId(id)
const createdAt = '2026-01-01T00:00:00.000Z'
const organization = { id: organizationId, name: ' Time ', createdAt }
const user = {
  id: userId,
  organizationId,
  name: ' Maria  da Silva ',
  email: 'maria@example.com',
  role: 'collaborator' as const,
  defaultRateCents: 4500,
  createdAt,
}
const contributor = {
  id: toContributorId(id),
  organizationId,
  name: ' Cliente ',
  source: 'manual' as const,
  defaultRateCents: 2000,
  createdBy: userId,
  createdAt,
}
const project = {
  id: toProjectId(id),
  organizationId,
  name: '  Gestão   de ÁREA  ',
  createdBy: userId,
  createdAt,
}

describe('entidades de organização', () => {
  it('cria organização com nome aparado', () =>
    expect(createOrganization(organization)).toEqual({
      ...organization,
      name: 'Time',
      defaultRateCents: 4500,
    }))
  it('cria usuário e deriva iniciais do primeiro e último nomes', () =>
    expect(createUser(user)).toEqual({ ...user, name: 'Maria  da Silva', initials: 'MS' }))
  it('usa uma inicial para nome único', () =>
    expect(createUser({ ...user, name: 'pedro' }).initials).toBe('P'))
  it('cria stakeholder sem vínculo com conta e preserva origem externa', () =>
    expect(createContributor({ ...contributor, source: 'azure', externalId: 'abc' })).toEqual({
      ...contributor,
      name: 'Cliente',
      source: 'azure',
      externalId: 'abc',
    }))
  it('normaliza a chave do projeto sem alterar espaços internos do nome', () =>
    expect(createProject(project)).toEqual({
      ...project,
      name: 'Gestão   de ÁREA',
      nameKey: 'gestao de area',
      archivedAt: null,
    }))
  it.each(['', '   ', '\n\t'])('rejeita nome vazio %j nas quatro entidades', (name) => {
    expect(() => createOrganization({ ...organization, name })).toThrow(ValidationError)
    expect(() => createUser({ ...user, name })).toThrow(ValidationError)
    expect(() => createContributor({ ...contributor, name })).toThrow(ValidationError)
    expect(() => createProject({ ...project, name })).toThrow(ValidationError)
  })
  it('aceita usuário sem valor/hora próprio (null usa o padrão da organização)', () =>
    expect(createUser({ ...user, defaultRateCents: null }).defaultRateCents).toBeNull())
  it('aceita valor/hora padrão zero como não definido', () => {
    expect(createUser({ ...user, defaultRateCents: 0 }).defaultRateCents).toBe(0)
    expect(createContributor({ ...contributor, defaultRateCents: 0 }).defaultRateCents).toBe(0)
  })
  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejeita valor/hora padrão inválido %s',
    (defaultRateCents) => {
      expect(() => createUser({ ...user, defaultRateCents })).toThrow(ValidationError)
      expect(() => createContributor({ ...contributor, defaultRateCents })).toThrow(ValidationError)
    },
  )
  it('rejeita origem e papel inválidos', () => {
    expect(() => createContributor({ ...contributor, source: 'invalid' as 'manual' })).toThrow(
      ValidationError,
    )
    expect(() => createUser({ ...user, role: 'invalid' as 'manager' })).toThrow(ValidationError)
  })
})
