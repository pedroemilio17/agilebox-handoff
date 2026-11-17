import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  createDeliverable,
  createMilestone,
  createTask,
  toDeliverableId,
  toMilestoneId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
  updateMilestone,
  ValidationError,
} from '@agilebox/core'
import type { Deliverable, Milestone, Project, Task, User } from '@agilebox/core'
import type {
  DeliverableRepository,
  MilestoneRepository,
  ProjectRepository,
  TaskRepository,
  UserRepository,
} from '../ports'
import { aProject, aUser } from './builders'

export interface DeliverableRepositoryContractAdapters {
  readonly projects: ProjectRepository
  readonly users: UserRepository
  readonly tasks: TaskRepository
  readonly deliverables: DeliverableRepository
  readonly milestones: MilestoneRepository
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

/** Entrega criada pelo domínio (valida profundidade e pai no mesmo projeto). */
function aDeliverable(
  id: number,
  overrides: {
    organizationId?: Deliverable['organizationId']
    projectId?: Deliverable['projectId']
    parent?: Deliverable | null
    position?: number
    createdBy?: Deliverable['createdBy']
  } = {},
): Deliverable {
  const parent = overrides.parent ?? null
  return createDeliverable(
    {
      id: toDeliverableId(ulid(300 + id)),
      organizationId: overrides.organizationId ?? orgA,
      projectId: overrides.projectId ?? projectA,
      parentId: parent?.id ?? null,
      title: `Entrega ${id}`,
      position: overrides.position ?? 0,
      createdBy: overrides.createdBy ?? userA,
      createdAt: at,
    },
    parent ? [parent] : [],
  )
}

function aMilestone(
  id: number,
  overrides: Partial<{
    organizationId: Milestone['organizationId']
    projectId: Milestone['projectId']
    dueOn: string
    deliverableId: Milestone['deliverableId']
    createdBy: Milestone['createdBy']
  }> = {},
): Milestone {
  return createMilestone({
    id: toMilestoneId(ulid(400 + id)),
    organizationId: overrides.organizationId ?? orgA,
    projectId: overrides.projectId ?? projectA,
    title: `Marco ${id}`,
    dueOn: overrides.dueOn ?? '2026-06-30',
    deliverableId: overrides.deliverableId ?? null,
    criterion: null,
    createdBy: overrides.createdBy ?? userA,
    createdAt: at,
  })
}

function aTask(
  n: number,
  projectId: Task['projectId'],
  organizationId: Task['organizationId'] = orgA,
): Task {
  return createTask({
    id: toTaskId(ulid(500 + n)),
    organizationId,
    number: n,
    projectId,
    projectName: 'Projeto',
    createdBy: userA,
    title: `Tarefa ${n}`,
    createdAt: at,
    responsibleParticipationId: toParticipationId(ulid(600 + n)),
    responsibleRateCents: 0,
  })
}

/** Pessoas e projetos das duas organizações, como o contrato de sprints. */
async function seed(repos: DeliverableRepositoryContractAdapters) {
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

export function describeDeliverableRepositoryContract(
  name: string,
  makeAdapters: () => DeliverableRepositoryContractAdapters,
): void {
  describe(`contrato dos repositórios de entregas: ${name}`, () => {
    it('lista por projeto na ordem de pai e posição, e grava de novo sem duplicar', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const root1 = aDeliverable(1, { position: 0 })
      const root2 = aDeliverable(2, { position: 1 })
      const child = aDeliverable(3, { parent: root1, position: 0 })
      await repos.deliverables.save(orgA, root1)
      await repos.deliverables.save(orgA, child)
      await repos.deliverables.save(orgA, root2)
      await repos.deliverables.save(orgA, root1)

      const listed = await repos.deliverables.listByProject(orgA, projectA)
      expect(listed.map((item) => item.id)).toEqual([root1.id, root2.id, child.id])
      await expect(repos.deliverables.findById(orgA, child.id)).resolves.toEqual(child)
      await expect(repos.deliverables.listByProject(orgA, projectA2)).resolves.toEqual([])
    })

    it('isola por organização: a outra organização não lê nem acha as entregas', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const root = aDeliverable(1)
      await repos.deliverables.save(orgA, root)
      await expect(repos.deliverables.findById(orgB, root.id)).resolves.toBeNull()
      await expect(repos.deliverables.listByProject(orgB, projectA)).resolves.toEqual([])
    })

    it('reordena irmãos com saveMany', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const first = aDeliverable(1, { position: 0 })
      const second = aDeliverable(2, { position: 1 })
      await repos.deliverables.saveMany(orgA, [first, second])
      await repos.deliverables.saveMany(orgA, [
        { ...first, position: 1 },
        { ...second, position: 0 },
      ])
      const listed = await repos.deliverables.listByProject(orgA, projectA)
      expect(listed.map((item) => item.id)).toEqual([second.id, first.id])
    })

    it('recusa pai de outra organização, pai de outro projeto, projeto e criador de outra organização', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const foreignRoot = aDeliverable(1, {
        organizationId: orgB,
        projectId: projectB,
        createdBy: userB,
      })
      await repos.deliverables.save(orgB, foreignRoot)
      const otherProjectRoot = aDeliverable(2, { projectId: projectA2 })
      await repos.deliverables.save(orgA, otherProjectRoot)

      const fakeChild = { ...aDeliverable(3), parentId: foreignRoot.id }
      await expect(repos.deliverables.save(orgA, fakeChild)).rejects.toThrow(ValidationError)
      const crossParent = { ...aDeliverable(4), parentId: otherProjectRoot.id }
      await expect(repos.deliverables.save(orgA, crossParent)).rejects.toThrow(ValidationError)
      await expect(
        repos.deliverables.save(orgA, aDeliverable(5, { projectId: projectB })),
      ).rejects.toThrow(ValidationError)
      await expect(
        repos.deliverables.save(orgA, aDeliverable(6, { createdBy: userB })),
      ).rejects.toThrow(ValidationError)
    })

    it('apaga só entrega sem filhos, tarefas nem marcos ligados', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const parent = aDeliverable(1)
      const child = aDeliverable(2, { parent })
      const withTask = aDeliverable(3, { position: 1 })
      const withMilestone = aDeliverable(4, { position: 2 })
      const free = aDeliverable(5, { position: 3 })
      for (const item of [parent, child, withTask, withMilestone, free])
        await repos.deliverables.save(orgA, item)
      await repos.tasks.save(orgA, { ...aTask(1, projectA), deliverableId: withTask.id })
      await repos.milestones.save(orgA, aMilestone(1, { deliverableId: withMilestone.id }))

      expect(await repos.deliverables.countChildren(orgA, parent.id)).toBe(1)
      expect(await repos.deliverables.countTasks(orgA, withTask.id)).toBe(1)
      expect(await repos.deliverables.countMilestones(orgA, withMilestone.id)).toBe(1)

      await expect(repos.deliverables.delete(orgA, parent.id)).rejects.toThrow(ConflictError)
      await expect(repos.deliverables.delete(orgA, withTask.id)).rejects.toThrow(ConflictError)
      await expect(repos.deliverables.delete(orgA, withMilestone.id)).rejects.toThrow(ConflictError)
      await expect(repos.deliverables.findById(orgA, parent.id)).resolves.not.toBeNull()

      await repos.deliverables.delete(orgA, free.id)
      await expect(repos.deliverables.findById(orgA, free.id)).resolves.toBeNull()
      // Depois de soltar o filho, o pai também pode sair.
      await repos.deliverables.delete(orgA, child.id)
      await repos.deliverables.delete(orgA, parent.id)
      await expect(repos.deliverables.findById(orgA, parent.id)).resolves.toBeNull()
    })

    it('tarefa aponta para entrega do mesmo projeto, e a entrega de outro projeto é recusada', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const deliverable = aDeliverable(1)
      const foreign = aDeliverable(2, { projectId: projectA2 })
      await repos.deliverables.save(orgA, deliverable)
      await repos.deliverables.save(orgA, foreign)

      const task = aTask(1, projectA)
      await repos.tasks.save(orgA, { ...task, deliverableId: deliverable.id })
      expect((await repos.tasks.findById(orgA, task.id))?.deliverableId).toBe(deliverable.id)
      expect(await repos.deliverables.countTasks(orgA, deliverable.id)).toBe(1)

      await expect(
        repos.tasks.save(orgA, { ...aTask(2, projectA), deliverableId: foreign.id }),
      ).rejects.toThrow(ValidationError)
      await expect(
        repos.tasks.save(orgA, {
          ...aTask(3, projectA),
          deliverableId: toDeliverableId(ulid(999)),
        }),
      ).rejects.toThrow(ValidationError)

      await repos.tasks.save(orgA, { ...task, deliverableId: null })
      expect((await repos.tasks.findById(orgA, task.id))?.deliverableId).toBeNull()
    })

    it('tarefa de outra organização não ganha entrega de outra organização', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const foreign = aDeliverable(1, {
        organizationId: orgB,
        projectId: projectB,
        createdBy: userB,
      })
      await repos.deliverables.save(orgB, foreign)
      await expect(
        repos.tasks.save(orgA, { ...aTask(4, projectA), deliverableId: foreign.id }),
      ).rejects.toThrow(ValidationError)
    })
  })
}

export function describeMilestoneRepositoryContract(
  name: string,
  makeAdapters: () => DeliverableRepositoryContractAdapters,
): void {
  describe(`contrato dos repositórios de marcos: ${name}`, () => {
    it('lista por projeto em ordem de data-alvo e atualiza o mesmo marco', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const late = aMilestone(1, { dueOn: '2026-09-01' })
      const early = aMilestone(2, { dueOn: '2026-05-10' })
      await repos.milestones.save(orgA, late)
      await repos.milestones.save(orgA, early)
      await repos.milestones.save(
        orgA,
        updateMilestone(early, { criterion: 'Aprovado pela diretoria' }),
      )

      const listed = await repos.milestones.listByProject(orgA, projectA)
      expect(listed.map((item) => item.id)).toEqual([early.id, late.id])
      expect(listed[0]?.criterion).toBe('Aprovado pela diretoria')
      await expect(repos.milestones.findById(orgA, late.id)).resolves.toEqual(late)
      await expect(repos.milestones.listByProject(orgA, projectA2)).resolves.toEqual([])
    })

    it('isola por organização e aceita vínculo com entrega do mesmo projeto', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const deliverable = aDeliverable(1)
      await repos.deliverables.save(orgA, deliverable)
      const linked = aMilestone(3, { deliverableId: deliverable.id })
      await repos.milestones.save(orgA, linked)
      await expect(repos.milestones.findById(orgB, linked.id)).resolves.toBeNull()
      await expect(repos.milestones.listByProject(orgB, projectA)).resolves.toEqual([])
      expect((await repos.milestones.findById(orgA, linked.id))?.deliverableId).toBe(deliverable.id)
    })

    it('recusa entrega de outro projeto, de outra organização e projeto de outra organização', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const foreignProjectDeliverable = aDeliverable(1, { projectId: projectA2 })
      await repos.deliverables.save(orgA, foreignProjectDeliverable)
      const foreignOrgDeliverable = aDeliverable(2, {
        organizationId: orgB,
        projectId: projectB,
        createdBy: userB,
      })
      await repos.deliverables.save(orgB, foreignOrgDeliverable)

      await expect(
        repos.milestones.save(orgA, aMilestone(4, { deliverableId: foreignProjectDeliverable.id })),
      ).rejects.toThrow(ValidationError)
      await expect(
        repos.milestones.save(orgA, aMilestone(5, { deliverableId: foreignOrgDeliverable.id })),
      ).rejects.toThrow(ValidationError)
      await expect(
        repos.milestones.save(orgA, aMilestone(6, { projectId: projectB })),
      ).rejects.toThrow(ValidationError)
    })

    it('apaga o marco sem tocar nas entregas', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const deliverable = aDeliverable(1)
      await repos.deliverables.save(orgA, deliverable)
      const milestone = aMilestone(7, { deliverableId: deliverable.id })
      await repos.milestones.save(orgA, milestone)
      await repos.milestones.delete(orgA, milestone.id)
      await expect(repos.milestones.findById(orgA, milestone.id)).resolves.toBeNull()
      await expect(repos.deliverables.findById(orgA, deliverable.id)).resolves.not.toBeNull()
    })
  })
}
