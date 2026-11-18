import { describe, expect, it } from 'vitest'
import { toModuleId, ValidationError } from '@agilebox/core'
import type { NewProjectModuleEvent, ProjectModuleEventRepository } from '../ports'
import { projectModulesFixtures } from './project-modules-repository-contract'

/**
 * Histórico de módulos por projeto (ADR-10). Os adaptadores recebem a organização e o projeto já
 * semeados (`projectModulesSeed`), como nos módulos. Quem chama grava o histórico dentro da própria
 * unidade de trabalho; aqui só se testa a porta.
 */
const { organizationA, organizationB, managerA, projectA, projectA2, projectB } =
  projectModulesFixtures

const T0 = '2026-11-16T10:00:00.000Z'
const T1 = '2026-11-16T11:00:00.000Z'
const T2 = '2026-11-16T12:00:00.000Z'

function anEvent(
  overrides: Partial<NewProjectModuleEvent> & Pick<NewProjectModuleEvent, 'at'>,
): NewProjectModuleEvent {
  return {
    organizationId: organizationA,
    projectId: projectA,
    moduleId: toModuleId('sprints'),
    action: 'enabled',
    actorId: managerA,
    actorRole: 'manager',
    auto: false,
    relatedModuleId: null,
    ...overrides,
  }
}

export function describeProjectModuleEventRepositoryContract(
  name: string,
  makeRepository: () => Promise<ProjectModuleEventRepository>,
) {
  describe(`histórico de módulos por projeto: ${name}`, () => {
    it('lista do mais recente para o mais antigo, e o id cresce na ordem de gravação', async () => {
      const repository = await makeRepository()
      await repository.append(organizationA, [
        anEvent({ at: T0, moduleId: toModuleId('backlog') }),
        anEvent({ at: T2, action: 'disabled' }),
        anEvent({ at: T1 }),
      ])

      const events = await repository.listByProject(organizationA, projectA, 10)

      expect(events.map((event) => event.at)).toEqual([T2, T1, T0])
      expect(events[0]?.action).toBe('disabled')
      // O id segue a ordem de gravação, não a do instante: o T0 foi gravado primeiro.
      const idAt = (at: string) => events.find((event) => event.at === at)!.id
      expect(idAt(T0)).toBeLessThan(idAt(T2))
    })

    it('empate de instante: o último gravado vem primeiro', async () => {
      const repository = await makeRepository()
      await repository.append(organizationA, [
        anEvent({ at: T1, moduleId: toModuleId('backlog') }),
        anEvent({ at: T1, moduleId: toModuleId('sprints') }),
      ])

      const events = await repository.listByProject(organizationA, projectA, 10)

      expect(events.map((event) => event.moduleId)).toEqual(['sprints', 'backlog'])
    })

    it('guarda autoria, papel, cascata e módulo relacionado sem alterar nada', async () => {
      const repository = await makeRepository()
      await repository.append(organizationA, [
        anEvent({
          at: T1,
          moduleId: toModuleId('burndown'),
          action: 'disabled',
          actorRole: 'collaborator',
          auto: true,
          relatedModuleId: toModuleId('sprints'),
        }),
      ])

      const [event] = await repository.listByProject(organizationA, projectA, 10)

      expect(event).toMatchObject({
        organizationId: organizationA,
        projectId: projectA,
        moduleId: 'burndown',
        action: 'disabled',
        actorId: managerA,
        actorRole: 'collaborator',
        auto: true,
        relatedModuleId: 'sprints',
        at: T1,
      })
    })

    it('respeita o limite pedido', async () => {
      const repository = await makeRepository()
      await repository.append(organizationA, [
        anEvent({ at: T0 }),
        anEvent({ at: T1 }),
        anEvent({ at: T2 }),
      ])

      const events = await repository.listByProject(organizationA, projectA, 2)

      expect(events.map((event) => event.at)).toEqual([T2, T1])
    })

    it('projeto sem eventos devolve lista vazia, e a lista vazia não grava nada', async () => {
      const repository = await makeRepository()
      await repository.append(organizationA, [])
      await repository.append(organizationA, [anEvent({ at: T0 })])

      expect(await repository.listByProject(organizationA, projectA2, 10)).toEqual([])
      expect(await repository.listByProject(organizationA, projectA, 10)).toHaveLength(1)
    })

    it('eventos de outro projeto não aparecem na leitura deste', async () => {
      const repository = await makeRepository()
      await repository.append(organizationA, [anEvent({ at: T0, projectId: projectA2 })])

      expect(await repository.listByProject(organizationA, projectA, 10)).toEqual([])
    })

    it('isolamento por organização: a outra organização não lê nem vê o histórico', async () => {
      const repository = await makeRepository()
      await repository.append(organizationB, [
        anEvent({
          at: T0,
          organizationId: organizationB,
          projectId: projectB,
          actorId: managerA,
        }),
      ])

      expect(await repository.listByProject(organizationA, projectB, 10)).toEqual([])
      expect(await repository.listByProject(organizationB, projectB, 10)).toHaveLength(1)
    })

    it('limite inválido é recusado com ValidationError', async () => {
      const repository = await makeRepository()

      await expect(repository.listByProject(organizationA, projectA, 0)).rejects.toBeInstanceOf(
        ValidationError,
      )
    })
  })
}
