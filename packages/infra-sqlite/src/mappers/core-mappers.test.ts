import { describe, expect, it } from 'vitest'
import { toOrganizationId } from '@agilebox/core'
import { aContributor, aProject, aUser } from '@agilebox/application/testing'
import { mapContributorRow, mapOrganizationRow, mapProjectRow, mapUserRow } from './core-mappers.js'

describe('mappers de registros principais', () => {
  it('converte registros de organização, usuário, entidade e projeto para o domínio', () => {
    const user = aUser().build()
    const contributor = aContributor().build()
    const project = aProject().build()
    expect(
      mapOrganizationRow({
        id: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV'),
        name: 'AgileBox',
        defaultRateCents: 4500,
        createdAt: user.createdAt,
      }),
    ).toEqual({
      id: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV'),
      name: 'AgileBox',
      defaultRateCents: 4500,
      createdAt: user.createdAt,
    })
    expect(mapUserRow({ ...user })).toEqual(user)
    expect(mapContributorRow({ ...contributor, externalId: null })).toEqual(contributor)
    expect(mapProjectRow({ ...project })).toEqual(project)
  })
})
