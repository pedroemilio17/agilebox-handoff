import { describe, expect, it } from 'vitest'
import { aUser } from '@agilebox/application/testing'
import {
  createDefinitionOfDoneItem,
  createProject,
  toDefinitionOfDoneItemId,
  toOrganizationId,
  toProjectId,
  toUserId,
} from '@agilebox/core'
import type { DefinitionOfDoneItem, OrganizationId, ProjectId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { organizations } from '../schema/index.js'
import { createSqliteCoreRepositories } from './core-repositories.js'
import { createSqliteDefinitionOfDoneRepository } from './definition-of-done-repository.js'

const createdAt = '2026-01-01T00:00:00.000Z'
const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
const userA = toUserId('00000000000000000000000002')
const userB = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB2')
const projectA = toProjectId('00000000000000000000000003')
const projectB = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB3')

function itemId(n: number) {
  return toDefinitionOfDoneItemId(`0000000000000000000000${String(n).padStart(4, '0')}`)
}

function itemOf(
  n: number,
  organizationId: OrganizationId,
  projectId: ProjectId,
  title: string,
  position: number,
): DefinitionOfDoneItem {
  return createDefinitionOfDoneItem({
    id: itemId(n),
    organizationId,
    projectId,
    title,
    position,
  })
}

async function setup() {
  const database = createSqliteClient(':memory:')
  database
    .insert(organizations)
    .values([
      { id: orgA, name: 'A', createdAt },
      { id: orgB, name: 'B', createdAt },
    ])
    .run()
  const core = createSqliteCoreRepositories(database)
  await core.users.save(orgA, aUser().with({ id: userA, organizationId: orgA }).build())
  await core.users.save(orgB, aUser().with({ id: userB, organizationId: orgB }).build())
  await core.projects.save(
    orgA,
    createProject({ id: projectA, organizationId: orgA, name: 'A', createdBy: userA, createdAt }),
  )
  await core.projects.save(
    orgB,
    createProject({ id: projectB, organizationId: orgB, name: 'B', createdBy: userB, createdAt }),
  )
  return {
    database,
    repository: createSqliteDefinitionOfDoneRepository(database),
  }
}

describe('repositório da definição de pronto', () => {
  it('grava e lista em ordem de posição, por projeto', async () => {
    const { repository } = await setup()
    await repository.saveMany(orgA, [
      itemOf(2, orgA, projectA, 'Documentação atualizada', 1),
      itemOf(1, orgA, projectA, 'Testes passando', 0),
    ])
    await expect(repository.listByProject(orgA, projectA)).resolves.toEqual([
      expect.objectContaining({ title: 'Testes passando', position: 0 }),
      expect.objectContaining({ title: 'Documentação atualizada', position: 1 }),
    ])
  })

  it('atualiza título e posição e remove um item', async () => {
    const { repository } = await setup()
    await repository.saveMany(orgA, [
      itemOf(1, orgA, projectA, 'A', 0),
      itemOf(2, orgA, projectA, 'B', 1),
    ])
    await repository.saveMany(orgA, [itemOf(2, orgA, projectA, 'B revisado', 0)])
    await repository.remove(orgA, itemId(1))
    await expect(repository.listByProject(orgA, projectA)).resolves.toEqual([
      expect.objectContaining({ id: itemId(2), title: 'B revisado', position: 0 }),
    ])
  })

  it('isola organizações: não lista, não grava e não remove dados de outra', async () => {
    const { repository } = await setup()
    await repository.saveMany(orgA, [itemOf(1, orgA, projectA, 'Só da A', 0)])
    await expect(repository.listByProject(orgB, projectA)).resolves.toEqual([])
    await expect(repository.listByOrganization(orgB)).resolves.toEqual([])

    // Item da organização B gravado em projeto da A: ignorado.
    await repository.saveMany(orgB, [itemOf(2, orgB, projectA, 'Intruso', 0)])
    await expect(repository.listByProject(orgA, projectA)).resolves.toEqual([
      expect.objectContaining({ title: 'Só da A' }),
    ])
    // Item da organização A gravado com a organização B como contexto: ignorado.
    await repository.saveMany(orgB, [itemOf(3, orgA, projectA, 'Trocado', 1)])
    await expect(repository.listByProject(orgA, projectA)).resolves.toHaveLength(1)

    // Remover com a organização errada não apaga.
    await repository.remove(orgB, itemId(1))
    await expect(repository.listByProject(orgA, projectA)).resolves.toHaveLength(1)
  })

  it('lista por organização para contar itens de todos os projetos', async () => {
    const { repository } = await setup()
    await repository.saveMany(orgA, [
      itemOf(1, orgA, projectA, 'A1', 0),
      itemOf(2, orgA, projectA, 'A2', 1),
    ])
    await repository.saveMany(orgB, [itemOf(3, orgB, projectB, 'B1', 0)])
    const all = await repository.listByOrganization(orgA)
    expect(all.map((item) => item.title)).toEqual(['A1', 'A2'])
  })

  it('apagar o projeto apaga os itens dele (cascata)', async () => {
    const { database, repository } = await setup()
    await repository.saveMany(orgA, [itemOf(1, orgA, projectA, 'A1', 0)])
    database.$client.prepare('DELETE FROM projects WHERE id = ?').run(projectA)
    await expect(repository.listByProject(orgA, projectA)).resolves.toEqual([])
    expect(
      database.$client.prepare('SELECT COUNT(*) AS total FROM definition_of_done_items').get() as {
        total: number
      },
    ).toEqual({ total: 0 })
  })
})
