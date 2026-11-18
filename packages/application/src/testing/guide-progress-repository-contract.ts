import { describe, expect, it } from 'vitest'
import {
  createProject,
  createUser,
  toOrganizationId,
  toProjectId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { OrganizationId, ProjectId, UserId } from '@agilebox/core'
import type { GuideProgressRepository } from '../ports'
import { GUIDE_CARD_KEY, GUIDE_WELCOME_KEY } from '../ports/guide-progress-repository'

/** Ids fixos do contrato. Quem roda o contrato cria, antes, o que `guideProgressSeed` descreve. */
export const guideProgressFixtures = {
  organizationA: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FD0'),
  organizationB: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FD1'),
  managerA: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FD2'),
  collaboratorA: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FD3'),
  managerB: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FD4'),
  projectA: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FD5'),
  /** Segundo projeto da organização A: o progresso não pode vazar de um para o outro. */
  projectA2: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FD6'),
  projectB: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FD7'),
} as const

const createdAt = '2026-01-01T00:00:00.000Z'
const FIRST = '2026-11-16T10:00:00.000Z'
const LATER = '2026-11-16T11:00:00.000Z'

/** Dados mínimos para o armazenamento de cada implementação: pessoas e projetos por organização. */
export function guideProgressSeed() {
  const {
    organizationA,
    organizationB,
    managerA,
    collaboratorA,
    managerB,
    projectA,
    projectA2,
    projectB,
  } = guideProgressFixtures
  const user = (id: UserId, organizationId: OrganizationId, role: 'manager' | 'collaborator') =>
    createUser({
      id,
      organizationId,
      name: `Pessoa ${id.slice(-2)}`,
      email: `${id}@example.com`,
      role,
      defaultRateCents: 4500,
      createdAt,
    })
  const project = (id: ProjectId, organizationId: OrganizationId, createdBy: UserId) =>
    createProject({ id, organizationId, name: `Projeto ${id.slice(-2)}`, createdBy, createdAt })
  return {
    users: [
      user(managerA, organizationA, 'manager'),
      user(collaboratorA, organizationA, 'collaborator'),
      user(managerB, organizationB, 'manager'),
    ],
    projects: [
      project(projectA, organizationA, managerA),
      project(projectA2, organizationA, managerA),
      project(projectB, organizationB, managerB),
    ],
  }
}

/**
 * Contrato do progresso do guia: vale para o fake em memória e para o SQLite. `makeRepository`
 * devolve um repositório já com as pessoas e os projetos de `guideProgressSeed`.
 */
export function describeGuideProgressRepositoryContract(
  name: string,
  makeRepository: () => Promise<GuideProgressRepository>,
): void {
  const {
    organizationA,
    organizationB,
    managerA,
    collaboratorA,
    managerB,
    projectA,
    projectA2,
    projectB,
  } = guideProgressFixtures

  describe(`contrato do progresso do guia: ${name}`, () => {
    it('pessoa sem linhas devolve lista vazia', async () => {
      const repository = await makeRepository()
      expect(await repository.listForUser(organizationA, projectA, managerA)).toEqual([])
    })

    it('markDone cria uma linha por passo, com o instante e sem dispensa', async () => {
      const repository = await makeRepository()
      await repository.markDone(
        organizationA,
        projectA,
        managerA,
        ['agil.backlog', 'agil.sprint'],
        FIRST,
      )

      const rows = await repository.listForUser(organizationA, projectA, managerA)
      expect(rows).toHaveLength(2)
      expect(rows).toEqual(
        expect.arrayContaining([
          { stepKey: 'agil.backlog', doneAt: FIRST, dismissed: false },
          { stepKey: 'agil.sprint', doneAt: FIRST, dismissed: false },
        ]),
      )
    })

    it('markDone é idempotente e preserva o primeiro done_at', async () => {
      const repository = await makeRepository()
      await repository.markDone(organizationA, projectA, managerA, ['agil.backlog'], FIRST)
      await repository.markDone(organizationA, projectA, managerA, ['agil.backlog'], LATER)

      expect(await repository.listForUser(organizationA, projectA, managerA)).toEqual([
        { stepKey: 'agil.backlog', doneAt: FIRST, dismissed: false },
      ])
    })

    it('markDone com lista vazia não grava nada', async () => {
      const repository = await makeRepository()
      await repository.markDone(organizationA, projectA, managerA, [], FIRST)
      expect(await repository.listForUser(organizationA, projectA, managerA)).toEqual([])
    })

    it('markDone de passo com chave repetida na mesma chamada grava uma linha só', async () => {
      const repository = await makeRepository()
      await repository.markDone(
        organizationA,
        projectA,
        managerA,
        ['agil.backlog', 'agil.backlog'],
        FIRST,
      )
      expect(await repository.listForUser(organizationA, projectA, managerA)).toHaveLength(1)
    })

    it('a chave reservada do cartão não é um passo: markDone a recusa sem gravar nada', async () => {
      const repository = await makeRepository()
      await expect(
        repository.markDone(
          organizationA,
          projectA,
          managerA,
          ['agil.backlog', GUIDE_CARD_KEY],
          FIRST,
        ),
      ).rejects.toThrow(ValidationError)
      expect(await repository.listForUser(organizationA, projectA, managerA)).toEqual([])
    })

    it('dismissCard grava a chave reservada com dispensa e sem done_at', async () => {
      const repository = await makeRepository()
      await repository.dismissCard(organizationA, projectA, managerA, FIRST)

      expect(await repository.listForUser(organizationA, projectA, managerA)).toEqual([
        { stepKey: GUIDE_CARD_KEY, doneAt: null, dismissed: true },
      ])
    })

    it('dismissCard é idempotente e não mexe nos passos concluídos', async () => {
      const repository = await makeRepository()
      await repository.markDone(organizationA, projectA, managerA, ['agil.backlog'], FIRST)
      await repository.dismissCard(organizationA, projectA, managerA, FIRST)
      await repository.dismissCard(organizationA, projectA, managerA, LATER)

      const rows = await repository.listForUser(organizationA, projectA, managerA)
      expect(rows).toHaveLength(2)
      expect(rows).toEqual(
        expect.arrayContaining([
          { stepKey: 'agil.backlog', doneAt: FIRST, dismissed: false },
          { stepKey: GUIDE_CARD_KEY, doneAt: null, dismissed: true },
        ]),
      )
    })

    it('markDone depois da dispensa não apaga a dispensa', async () => {
      const repository = await makeRepository()
      await repository.dismissCard(organizationA, projectA, managerA, FIRST)
      await repository.markDone(organizationA, projectA, managerA, ['agil.backlog'], LATER)

      const rows = await repository.listForUser(organizationA, projectA, managerA)
      expect(rows.find((row) => row.stepKey === GUIDE_CARD_KEY)?.dismissed).toBe(true)
    })

    it('a chave reservada da boas-vindas não é um passo: markDone a recusa sem gravar nada', async () => {
      const repository = await makeRepository()
      await expect(
        repository.markDone(
          organizationA,
          projectA,
          managerA,
          ['agil.backlog', GUIDE_WELCOME_KEY],
          FIRST,
        ),
      ).rejects.toThrow(ValidationError)
      expect(await repository.listForUser(organizationA, projectA, managerA)).toEqual([])
    })

    it('resolveWelcome grava a chave de boas-vindas com dispensa e sem done_at', async () => {
      const repository = await makeRepository()
      await repository.resolveWelcome(organizationA, projectA, collaboratorA, FIRST)

      expect(await repository.listForUser(organizationA, projectA, collaboratorA)).toEqual([
        { stepKey: GUIDE_WELCOME_KEY, doneAt: null, dismissed: true },
      ])
    })

    it('resolveWelcome é idempotente e não mexe nos passos nem na dispensa do cartão', async () => {
      const repository = await makeRepository()
      await repository.markDone(organizationA, projectA, managerA, ['agil.backlog'], FIRST)
      await repository.dismissCard(organizationA, projectA, managerA, FIRST)
      await repository.resolveWelcome(organizationA, projectA, managerA, FIRST)
      await repository.resolveWelcome(organizationA, projectA, managerA, LATER)

      const rows = await repository.listForUser(organizationA, projectA, managerA)
      expect(rows).toHaveLength(3)
      expect(rows).toEqual(
        expect.arrayContaining([
          { stepKey: 'agil.backlog', doneAt: FIRST, dismissed: false },
          { stepKey: GUIDE_CARD_KEY, doneAt: null, dismissed: true },
          { stepKey: GUIDE_WELCOME_KEY, doneAt: null, dismissed: true },
        ]),
      )
    })

    it('markDone depois da boas-vindas não apaga a resposta', async () => {
      const repository = await makeRepository()
      await repository.resolveWelcome(organizationA, projectA, managerA, FIRST)
      await repository.markDone(organizationA, projectA, managerA, ['agil.backlog'], LATER)

      const rows = await repository.listForUser(organizationA, projectA, managerA)
      expect(rows.find((row) => row.stepKey === GUIDE_WELCOME_KEY)?.dismissed).toBe(true)
    })

    it('isolamento da boas-vindas: outra pessoa do projeto e outro projeto começam do zero', async () => {
      const repository = await makeRepository()
      await repository.resolveWelcome(organizationA, projectA, managerA, FIRST)

      expect(await repository.listForUser(organizationA, projectA, collaboratorA)).toEqual([])
      expect(await repository.listForUser(organizationA, projectA2, managerA)).toEqual([])
      expect(await repository.listForUser(organizationB, projectA, managerA)).toEqual([])
    })

    it('resolveWelcome de projeto ou pessoa de outra organização, ou inexistente, é recusado', async () => {
      const repository = await makeRepository()
      const inexistente = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FD9')

      await expect(
        repository.resolveWelcome(organizationA, projectB, managerA, FIRST),
      ).rejects.toThrow(ValidationError)
      await expect(
        repository.resolveWelcome(organizationA, inexistente, managerA, FIRST),
      ).rejects.toThrow(ValidationError)
      await expect(
        repository.resolveWelcome(organizationA, projectA, managerB, FIRST),
      ).rejects.toThrow(ValidationError)
      await expect(
        repository.resolveWelcome(organizationB, projectA, managerB, FIRST),
      ).rejects.toThrow(ValidationError)
      expect(await repository.listForUser(organizationA, projectA, managerA)).toEqual([])
    })

    it('isolamento por projeto: o progresso de um projeto não aparece no outro', async () => {
      const repository = await makeRepository()
      await repository.markDone(organizationA, projectA, managerA, ['agil.backlog'], FIRST)
      await repository.dismissCard(organizationA, projectA, managerA, FIRST)

      expect(await repository.listForUser(organizationA, projectA2, managerA)).toEqual([])
    })

    it('isolamento por pessoa: outra pessoa do mesmo projeto começa do zero', async () => {
      const repository = await makeRepository()
      await repository.markDone(organizationA, projectA, managerA, ['agil.backlog'], FIRST)
      await repository.dismissCard(organizationA, projectA, managerA, FIRST)

      expect(await repository.listForUser(organizationA, projectA, collaboratorA)).toEqual([])
    })

    it('isolamento por organização: outra organização não lê nem grava o progresso', async () => {
      const repository = await makeRepository()
      await repository.markDone(organizationA, projectA, managerA, ['agil.backlog'], FIRST)

      expect(await repository.listForUser(organizationB, projectA, managerA)).toEqual([])
      await expect(
        repository.markDone(organizationB, projectA, managerB, ['agil.backlog'], LATER),
      ).rejects.toThrow(ValidationError)
      await expect(
        repository.dismissCard(organizationB, projectA, managerB, LATER),
      ).rejects.toThrow(ValidationError)
      expect(await repository.listForUser(organizationA, projectA, managerA)).toEqual([
        { stepKey: 'agil.backlog', doneAt: FIRST, dismissed: false },
      ])
    })

    it('projeto de outra organização, ou inexistente, é recusado com ValidationError', async () => {
      const repository = await makeRepository()
      const inexistente = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FD9')

      await expect(
        repository.markDone(organizationA, projectB, managerA, ['agil.backlog'], FIRST),
      ).rejects.toThrow(ValidationError)
      await expect(
        repository.markDone(organizationA, inexistente, managerA, ['agil.backlog'], FIRST),
      ).rejects.toThrow(ValidationError)
      await expect(
        repository.dismissCard(organizationA, projectB, managerA, FIRST),
      ).rejects.toThrow(ValidationError)
      expect(await repository.listForUser(organizationB, projectB, managerB)).toEqual([])
    })

    it('pessoa de outra organização é recusada com ValidationError', async () => {
      const repository = await makeRepository()
      await expect(
        repository.markDone(organizationA, projectA, managerB, ['agil.backlog'], FIRST),
      ).rejects.toThrow(ValidationError)
      await expect(
        repository.dismissCard(organizationA, projectA, managerB, FIRST),
      ).rejects.toThrow(ValidationError)
      expect(await repository.listForUser(organizationA, projectA, managerB)).toEqual([])
    })
  })
}
