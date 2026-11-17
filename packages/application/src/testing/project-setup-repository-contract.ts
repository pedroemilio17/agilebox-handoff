import { describe, expect, it } from 'vitest'
import { toProjectId, ValidationError } from '@agilebox/core'
import type { ProjectId, WizardAnswers } from '@agilebox/core'
import type { ProjectSetup, ProjectSetupRepository } from '../ports'
import { projectModulesFixtures } from './project-modules-repository-contract'

const { organizationA, organizationB, projectA, projectB } = projectModulesFixtures
const unknownProject = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FZZ')

const answers: WizardAnswers = {
  workType: 'finite',
  fixedDate: 'yes',
  scope: 'partly',
  experience: 'sometimes',
}

function setupOf(projectId: ProjectId, overrides: Partial<ProjectSetup> = {}): ProjectSetup {
  return {
    projectId,
    answers: null,
    recommendedPreset: 'simples',
    startedFromPreset: 'simples',
    guideLevel: 'never',
    ...overrides,
  }
}

/**
 * Contrato da configuração inicial do projeto: vale para o fake em memória e para o SQLite.
 * `makeRepository` devolve um repositório já com as organizações, gestores e projetos de
 * `projectModulesSeed` (o mesmo cenário dos módulos do projeto).
 */
export function describeProjectSetupRepositoryContract(
  name: string,
  makeRepository: () => Promise<ProjectSetupRepository>,
): void {
  describe(`contrato da configuração do projeto: ${name}`, () => {
    it('projeto sem configuração gravada devolve nulo', async () => {
      const repository = await makeRepository()
      expect(await repository.get(organizationA, projectA)).toBeNull()
    })

    it('save grava as respostas e os presets, e get devolve a mesma configuração', async () => {
      const repository = await makeRepository()
      const setup = setupOf(projectA, {
        answers,
        recommendedPreset: 'hibrido',
        startedFromPreset: 'agil',
        guideLevel: 'sometimes',
      })
      await repository.save(organizationA, setup)

      expect(await repository.get(organizationA, projectA)).toEqual(setup)
    })

    it('save com o mesmo projeto troca a configuração (upsert por projeto)', async () => {
      const repository = await makeRepository()
      await repository.save(organizationA, setupOf(projectA, { answers }))
      await repository.save(
        organizationA,
        setupOf(projectA, { recommendedPreset: 'kanban', guideLevel: 'always' }),
      )

      expect(await repository.get(organizationA, projectA)).toEqual(
        setupOf(projectA, { recommendedPreset: 'kanban', guideLevel: 'always' }),
      )
    })

    it('answers nulo é aceito (projeto criado sem o assistente)', async () => {
      const repository = await makeRepository()
      await repository.save(organizationA, setupOf(projectA))

      expect((await repository.get(organizationA, projectA))?.answers).toBeNull()
    })

    it('answers que não é objeto JSON simples é recusado sem gravar nada', async () => {
      const repository = await makeRepository()
      const invalid = [['finite'], 'finite', 42] as unknown as ProjectSetup['answers'][]
      for (const value of invalid) {
        await expect(
          repository.save(organizationA, setupOf(projectA, { answers: value })),
        ).rejects.toBeInstanceOf(ValidationError)
      }
      expect(await repository.get(organizationA, projectA)).toBeNull()
    })

    it('projeto de outra organização é recusado com ValidationError', async () => {
      const repository = await makeRepository()
      await expect(repository.save(organizationA, setupOf(projectB))).rejects.toBeInstanceOf(
        ValidationError,
      )
      expect(await repository.get(organizationB, projectB)).toBeNull()
    })

    it('projeto inexistente é recusado com ValidationError', async () => {
      const repository = await makeRepository()
      await expect(repository.save(organizationA, setupOf(unknownProject))).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    it('isolamento: a configuração de uma organização não aparece para a outra', async () => {
      const repository = await makeRepository()
      await repository.save(organizationA, setupOf(projectA, { answers }))

      expect(await repository.get(organizationB, projectA)).toBeNull()
      expect(await repository.get(organizationA, projectA)).not.toBeNull()
    })
  })
}
