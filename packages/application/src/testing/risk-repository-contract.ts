import { describe, expect, it } from 'vitest'
import {
  createDeliverable,
  createRisk,
  toDeliverableId,
  toOrganizationId,
  toProjectId,
  toRiskId,
  toUserId,
  updateRisk,
  ValidationError,
} from '@agilebox/core'
import type { Deliverable, Project, Risk, User } from '@agilebox/core'
import type {
  DeliverableRepository,
  ProjectRepository,
  RiskRepository,
  UserRepository,
} from '../ports'
import { aProject, aUser } from './builders'

export interface RiskRepositoryContractAdapters {
  readonly projects: ProjectRepository
  readonly users: UserRepository
  readonly deliverables: DeliverableRepository
  readonly risks: RiskRepository
}

/** Ids válidos (ULID) de teste: 26 caracteres. */
const ulid = (n: number) => String(n).padStart(26, '0')
const orgA = toOrganizationId(ulid(1))
const orgB = toOrganizationId(ulid(2))
const userA = toUserId(ulid(10))
const userB = toUserId(ulid(11))
const projectA = toProjectId(ulid(20))
const projectA2 = toProjectId(ulid(21))
const projectB = toProjectId(ulid(22))
const at = '2026-03-02T09:00:00.000Z'
const later = '2026-03-03T09:00:00.000Z'

function aRisk(
  id: number,
  overrides: Partial<{
    organizationId: Risk['organizationId']
    projectId: Risk['projectId']
    ownerId: Risk['ownerId']
    deliverableId: Risk['deliverableId']
    createdBy: Risk['createdBy']
  }> = {},
): Risk {
  return createRisk({
    id: toRiskId(ulid(700 + id)),
    organizationId: overrides.organizationId ?? orgA,
    projectId: overrides.projectId ?? projectA,
    title: `Risco ${id}`,
    description: null,
    probability: 2,
    impact: 2,
    response: null,
    ownerId: overrides.ownerId ?? null,
    deliverableId: overrides.deliverableId ?? null,
    createdBy: overrides.createdBy ?? userA,
    createdAt: at,
  })
}

function aDeliverable(id: number, projectId: Deliverable['projectId'] = projectA): Deliverable {
  return createDeliverable(
    {
      id: toDeliverableId(ulid(300 + id)),
      organizationId: orgA,
      projectId,
      parentId: null,
      title: `Entrega ${id}`,
      position: 0,
      createdBy: userA,
      createdAt: at,
    },
    [],
  )
}

/** Pessoas e projetos das duas organizações, como nos contratos de entregas e marcos. */
async function seed(repos: RiskRepositoryContractAdapters) {
  const user: User = aUser().with({ id: userA, organizationId: orgA }).build()
  const otherUser: User = aUser().with({ id: userB, organizationId: orgB }).build()
  const p1: Project = aProject()
    .with({ id: projectA, organizationId: orgA, createdBy: userA })
    .build()
  const p2: Project = aProject()
    .with({ id: projectA2, organizationId: orgA, name: 'Outro', createdBy: userA })
    .build()
  const pB: Project = aProject()
    .with({ id: projectB, organizationId: orgB, createdBy: userB })
    .build()
  await repos.users.save(orgA, user)
  await repos.users.save(orgB, otherUser)
  await repos.projects.save(orgA, p1)
  await repos.projects.save(orgA, p2)
  await repos.projects.save(orgB, pB)
}

export function describeRiskRepositoryContract(
  name: string,
  makeAdapters: () => RiskRepositoryContractAdapters,
): void {
  describe(`contrato do repositório de riscos: ${name}`, () => {
    it('lista por projeto, acha por id e grava de novo sem duplicar', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const first = aRisk(1)
      const second = aRisk(2)
      const other = aRisk(3, { projectId: projectA2 })
      await repos.risks.save(orgA, first)
      await repos.risks.save(orgA, second)
      await repos.risks.save(orgA, other)
      const changed = updateRisk(first, { impact: 3 }, later)
      await repos.risks.save(orgA, changed)

      const listed = await repos.risks.listByProject(orgA, projectA)
      expect(listed.map((item) => item.id).sort()).toEqual([first.id, second.id].sort())
      expect(listed.find((item) => item.id === first.id)).toEqual(changed)
      await expect(repos.risks.findById(orgA, other.id)).resolves.toEqual(other)
      await expect(repos.risks.listByProject(orgA, projectB)).resolves.toEqual([])
    })

    it('isola por organização: a outra organização não lê nem acha os riscos', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const risk = aRisk(1)
      await repos.risks.save(orgA, risk)
      await expect(repos.risks.findById(orgB, risk.id)).resolves.toBeNull()
      await expect(repos.risks.listByProject(orgB, projectA)).resolves.toEqual([])
    })

    it('apaga o risco e não acha mais', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const risk = aRisk(1)
      await repos.risks.save(orgA, risk)
      await repos.risks.delete(orgA, risk.id)
      await expect(repos.risks.findById(orgA, risk.id)).resolves.toBeNull()
      await expect(repos.risks.listByProject(orgA, projectA)).resolves.toEqual([])
    })

    it('guarda dono e entrega, e grava nulos ao desligá-los', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const deliverable = aDeliverable(1)
      await repos.deliverables.save(orgA, deliverable)
      const linked = aRisk(1, { ownerId: userA, deliverableId: deliverable.id })
      await repos.risks.save(orgA, linked)
      await expect(repos.risks.findById(orgA, linked.id)).resolves.toEqual(linked)

      const unlinked = updateRisk(linked, { ownerId: null, deliverableId: null }, later)
      await repos.risks.save(orgA, unlinked)
      const found = await repos.risks.findById(orgA, linked.id)
      expect(found?.ownerId).toBeNull()
      expect(found?.deliverableId).toBeNull()
    })

    it('recusa projeto e criador de outra organização', async () => {
      const repos = makeAdapters()
      await seed(repos)
      await expect(repos.risks.save(orgA, aRisk(1, { projectId: projectB }))).rejects.toThrow(
        ValidationError,
      )
      await expect(repos.risks.save(orgA, aRisk(2, { createdBy: userB }))).rejects.toThrow(
        ValidationError,
      )
    })

    it('recusa dono de outra organização', async () => {
      const repos = makeAdapters()
      await seed(repos)
      await expect(repos.risks.save(orgA, aRisk(1, { ownerId: userB }))).rejects.toThrow(
        ValidationError,
      )
    })

    it('recusa entrega de outro projeto e aceita entrega do mesmo projeto', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const otherProjectDeliverable = aDeliverable(2, projectA2)
      await repos.deliverables.save(orgA, otherProjectDeliverable)
      await expect(
        repos.risks.save(orgA, aRisk(1, { deliverableId: otherProjectDeliverable.id })),
      ).rejects.toThrow(ValidationError)

      const ownDeliverable = aDeliverable(3)
      await repos.deliverables.save(orgA, ownDeliverable)
      await expect(
        repos.risks.save(orgA, aRisk(2, { deliverableId: ownDeliverable.id })),
      ).resolves.toBeUndefined()
    })

    it('não regrava um risco que pertence a outra organização', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const risk = aRisk(1)
      await repos.risks.save(orgA, risk)
      await repos.risks.save(orgB, { ...risk, title: 'Invadido', organizationId: orgB })
      const found = await repos.risks.findById(orgA, risk.id)
      expect(found?.title).toBe(risk.title)
    })
  })
}
