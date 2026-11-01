import { describe, expect, it } from 'vitest'
import { toOrganizationId, toProjectId, toUserId } from '@agilebox/core'
import { aContributor, aProject, aUser } from '@agilebox/application/testing'
import { createSqliteClient } from '../client.js'
import { organizations } from '../schema/organizations.js'
import { createSqliteCoreRepositories } from './core-repositories.js'

describe('repositórios SQLite de organização, usuários, entidades e projetos', () => {
  it('grava e recupera usuários, entidades, projetos e membros', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    const repositories = createSqliteCoreRepositories(database)
    const contributor = aContributor().with({ organizationId, createdBy: user.id }).build()
    const project = aProject().with({ organizationId, createdBy: user.id }).build()
    const member = {
      projectId: project.id,
      userId: user.id,
      addedBy: user.id,
      addedAt: user.createdAt,
    }

    await repositories.users.save(organizationId, user)
    await repositories.contributors.save(organizationId, contributor)
    await repositories.projects.save(organizationId, project)
    await repositories.projects.addMember(organizationId, member)

    await expect(repositories.users.findById(organizationId, user.id)).resolves.toEqual(user)
    await expect(repositories.users.list(organizationId)).resolves.toEqual([user])
    await expect(
      repositories.contributors.findById(organizationId, contributor.id),
    ).resolves.toEqual(contributor)
    await expect(repositories.contributors.list(organizationId)).resolves.toEqual([contributor])
    await expect(repositories.projects.findById(organizationId, project.id)).resolves.toEqual(
      project,
    )
    await expect(
      repositories.projects.findByNameKey(organizationId, project.nameKey),
    ).resolves.toEqual(project)
    await expect(repositories.projects.listMembers(organizationId, project.id)).resolves.toEqual([
      member,
    ])
    database.$client.close()
  })

  it('isola consultas por organização e permite nome de projeto repetido em outra organização', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const otherOrganizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
    const user = aUser().with({ organizationId }).build()
    const otherUser = aUser()
      .with({ id: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX'), organizationId: otherOrganizationId })
      .build()
    await database.insert(organizations).values([
      { id: organizationId, name: 'A', createdAt: user.createdAt },
      { id: otherOrganizationId, name: 'B', createdAt: user.createdAt },
    ])
    const repositories = createSqliteCoreRepositories(database)
    const project = aProject().with({ organizationId, createdBy: user.id }).build()
    const otherProject = aProject()
      .with({
        id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FAY'),
        organizationId: otherOrganizationId,
        createdBy: otherUser.id,
      })
      .build()
    const contributor = aContributor().with({ organizationId, createdBy: user.id }).build()
    await repositories.users.save(organizationId, user)
    await repositories.users.save(otherOrganizationId, otherUser)
    await repositories.projects.save(organizationId, project)
    await repositories.projects.save(otherOrganizationId, otherProject)
    await repositories.contributors.save(organizationId, contributor)

    await expect(repositories.users.findById(otherOrganizationId, user.id)).resolves.toBeNull()
    await expect(repositories.users.list(otherOrganizationId)).resolves.toEqual([otherUser])
    await expect(repositories.contributors.list(otherOrganizationId)).resolves.toEqual([])
    await expect(
      repositories.projects.findByNameKey(organizationId, project.nameKey),
    ).resolves.toEqual(project)
    await expect(
      repositories.projects.findByNameKey(otherOrganizationId, project.nameKey),
    ).resolves.toEqual(otherProject)
    database.$client.close()
  })

  it('remove membros sem alterar o projeto', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    const repositories = createSqliteCoreRepositories(database)
    const project = aProject().with({ organizationId, createdBy: user.id }).build()
    const member = {
      projectId: project.id,
      userId: user.id,
      addedBy: user.id,
      addedAt: user.createdAt,
    }
    await repositories.users.save(organizationId, user)
    await repositories.projects.save(organizationId, project)
    await repositories.projects.addMember(organizationId, member)
    await repositories.projects.removeMember(organizationId, project.id, user.id)

    await expect(repositories.projects.listMembers(organizationId, project.id)).resolves.toEqual([])
    await expect(repositories.projects.findById(organizationId, project.id)).resolves.toEqual(
      project,
    )
    database.$client.close()
  })
})
