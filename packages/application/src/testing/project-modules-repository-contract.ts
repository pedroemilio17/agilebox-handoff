import { describe, expect, it } from 'vitest'
import {
  createProject,
  createUser,
  MODULE_IDS,
  toOrganizationId,
  toProjectId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { ModuleId, ModuleState, OrganizationId, UserId } from '@agilebox/core'
import type { ProjectModulesRepository } from '../ports'

/**
 * Ids fixos do contrato. Quem roda o contrato precisa criar, antes, as duas organizações, um
 * gestor e um projeto por organização no próprio armazenamento.
 */
export const projectModulesFixtures = {
  organizationA: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV'),
  organizationB: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW'),
  managerA: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX'),
  managerB: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAY'),
  projectA: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB0'),
  projectB: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB1'),
} as const

export const projectModulesCreatedAt = '2026-01-01T00:00:00.000Z'
const FIRST_CHANGE = '2026-11-16T10:00:00.000Z'
const SECOND_CHANGE = '2026-11-16T11:00:00.000Z'

/** Dados mínimos para o armazenamento de cada implementação: gestor e projeto por organização. */
export function projectModulesSeed() {
  const { organizationA, organizationB, managerA, managerB, projectA, projectB } =
    projectModulesFixtures
  const user = (id: UserId, organizationId: OrganizationId) =>
    createUser({
      id,
      organizationId,
      name: 'Gestora',
      email: `${id}@example.com`,
      role: 'manager',
      defaultRateCents: 4500,
      createdAt: projectModulesCreatedAt,
    })
  return {
    users: [user(managerA, organizationA), user(managerB, organizationB)],
    projects: [
      createProject({
        id: projectA,
        organizationId: organizationA,
        name: 'Projeto A',
        createdBy: managerA,
        createdAt: projectModulesCreatedAt,
      }),
      createProject({
        id: projectB,
        organizationId: organizationB,
        name: 'Projeto B',
        createdBy: managerB,
        createdAt: projectModulesCreatedAt,
      }),
    ],
  }
}

/**
 * Contrato dos módulos do projeto: vale para o fake em memória e para o SQLite. `makeRepository`
 * devolve um repositório já com as organizações, gestores e projetos de `projectModulesSeed`.
 */
export function describeProjectModulesRepositoryContract(
  name: string,
  makeRepository: () => Promise<ProjectModulesRepository>,
): void {
  const { organizationA, organizationB, managerA, managerB, projectA, projectB } =
    projectModulesFixtures
  const config = { horario: '09:00', dias: [1, 2, 3] }

  describe(`contrato dos módulos do projeto: ${name}`, () => {
    it('projeto sem linhas gravadas devolve lista vazia', async () => {
      const repository = await makeRepository()
      expect(await repository.list(organizationA, projectA)).toEqual([])
    })

    it('save cria as linhas e carimba quem mudou e quando', async () => {
      const repository = await makeRepository()
      await repository.save(
        organizationA,
        projectA,
        [{ moduleId: 'agenda', state: 'active' }],
        managerA,
        FIRST_CHANGE,
      )

      expect(await repository.list(organizationA, projectA)).toEqual([
        {
          moduleId: 'agenda',
          state: 'active',
          config: null,
          changedBy: managerA,
          changedAt: FIRST_CHANGE,
        },
      ])
    })

    it('save atualiza o estado, carimba a nova mudança e preserva a configuração quando ela é omitida', async () => {
      const repository = await makeRepository()
      await repository.save(
        organizationA,
        projectA,
        [{ moduleId: 'agenda', state: 'active', config }],
        managerA,
        FIRST_CHANGE,
      )
      await repository.save(
        organizationA,
        projectA,
        [{ moduleId: 'agenda', state: 'winding_down' }],
        managerA,
        SECOND_CHANGE,
      )

      expect(await repository.list(organizationA, projectA)).toEqual([
        {
          moduleId: 'agenda',
          state: 'winding_down',
          config,
          changedBy: managerA,
          changedAt: SECOND_CHANGE,
        },
      ])
    })

    it('save com configuração troca a configuração gravada', async () => {
      const repository = await makeRepository()
      await repository.save(
        organizationA,
        projectA,
        [{ moduleId: 'agenda', state: 'active', config }],
        managerA,
        FIRST_CHANGE,
      )
      const novo = { horario: '18:30' }
      await repository.save(
        organizationA,
        projectA,
        [{ moduleId: 'agenda', state: 'active', config: novo }],
        managerA,
        SECOND_CHANGE,
      )

      const [row] = await repository.list(organizationA, projectA)
      expect(row?.config).toEqual(novo)
    })

    it('list devolve as linhas em ordem do catálogo, não na ordem do pedido', async () => {
      const repository = await makeRepository()
      await repository.save(
        organizationA,
        projectA,
        [
          { moduleId: 'sprints', state: 'active' },
          { moduleId: 'agenda', state: 'active' },
          { moduleId: 'backlog', state: 'disabled' },
        ],
        managerA,
        FIRST_CHANGE,
      )

      const ids = (await repository.list(organizationA, projectA)).map((row) => row.moduleId)
      const expected = MODULE_IDS.filter((id) => ids.includes(id))
      expect(ids).toEqual(expected)
      expect(ids).toEqual(['agenda', 'backlog', 'sprints'])
    })

    it('save nunca apaga módulos fora do pedido', async () => {
      const repository = await makeRepository()
      await repository.save(
        organizationA,
        projectA,
        [
          { moduleId: 'agenda', state: 'active' },
          { moduleId: 'backlog', state: 'active' },
        ],
        managerA,
        FIRST_CHANGE,
      )
      await repository.save(
        organizationA,
        projectA,
        [{ moduleId: 'backlog', state: 'disabled' }],
        managerA,
        SECOND_CHANGE,
      )

      const rows = await repository.list(organizationA, projectA)
      expect(rows.map((row) => [row.moduleId, row.state])).toEqual([
        ['agenda', 'active'],
        ['backlog', 'disabled'],
      ])
    })

    it('isolamento: outra organização não lê nem grava as linhas do projeto', async () => {
      const repository = await makeRepository()
      await repository.save(
        organizationA,
        projectA,
        [{ moduleId: 'agenda', state: 'active' }],
        managerA,
        FIRST_CHANGE,
      )

      expect(await repository.list(organizationB, projectA)).toEqual([])
      await expect(
        repository.save(
          organizationB,
          projectA,
          [{ moduleId: 'agenda', state: 'disabled' }],
          managerB,
          SECOND_CHANGE,
        ),
      ).rejects.toThrow(ValidationError)

      expect(await repository.list(organizationA, projectA)).toEqual([
        {
          moduleId: 'agenda',
          state: 'active',
          config: null,
          changedBy: managerA,
          changedAt: FIRST_CHANGE,
        },
      ])
    })

    it('projeto inexistente ou de outra organização é recusado com ValidationError', async () => {
      const repository = await makeRepository()
      const inexistente = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB9')
      const change = [{ moduleId: 'agenda' as ModuleId, state: 'active' as ModuleState }]

      await expect(
        repository.save(organizationA, inexistente, change, managerA, FIRST_CHANGE),
      ).rejects.toThrow(ValidationError)
      await expect(
        repository.save(organizationA, projectB, change, managerA, FIRST_CHANGE),
      ).rejects.toThrow(ValidationError)
      expect(await repository.list(organizationB, projectB)).toEqual([])
    })

    it('ator de outra organização é recusado com ValidationError', async () => {
      const repository = await makeRepository()
      await expect(
        repository.save(
          organizationA,
          projectA,
          [{ moduleId: 'agenda', state: 'active' }],
          managerB,
          FIRST_CHANGE,
        ),
      ).rejects.toThrow(ValidationError)
      expect(await repository.list(organizationA, projectA)).toEqual([])
    })

    it('pedido inválido (módulo desconhecido, estado inválido ou módulo repetido) não grava nada', async () => {
      const repository = await makeRepository()
      const invalid: [string, { moduleId: ModuleId; state: ModuleState }[]][] = [
        [
          'módulo desconhecido',
          [
            { moduleId: 'agenda', state: 'active' },
            { moduleId: 'inexistente' as ModuleId, state: 'active' },
          ],
        ],
        [
          'estado inválido',
          [
            { moduleId: 'agenda', state: 'active' },
            { moduleId: 'backlog', state: 'pausado' as ModuleState },
          ],
        ],
        [
          'módulo repetido',
          [
            { moduleId: 'agenda', state: 'active' },
            { moduleId: 'agenda', state: 'disabled' },
          ],
        ],
      ]
      for (const [, changes] of invalid) {
        await expect(
          repository.save(organizationA, projectA, changes, managerA, FIRST_CHANGE),
        ).rejects.toThrow(ValidationError)
      }
      expect(await repository.list(organizationA, projectA)).toEqual([])
    })
  })
}
