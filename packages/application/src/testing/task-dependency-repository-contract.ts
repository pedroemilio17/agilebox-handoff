import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  createTask,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { Project, Task, TaskDependency, User } from '@agilebox/core'
import type {
  ProjectRepository,
  TaskDependencyRepository,
  TaskRepository,
  UserRepository,
} from '../ports'
import { aProject, aUser } from './builders'

export interface TaskDependencyRepositoryContractAdapters {
  readonly projects: ProjectRepository
  readonly users: UserRepository
  readonly tasks: TaskRepository
  readonly taskDependencies: TaskDependencyRepository
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

function aTask(
  n: number,
  projectId: Task['projectId'],
  organizationId: Task['organizationId'],
): Task {
  return createTask({
    id: toTaskId(ulid(500 + n + (organizationId === orgB ? 100 : 0))),
    organizationId,
    number: n,
    projectId,
    projectName: 'Projeto',
    createdBy: organizationId === orgB ? userB : userA,
    title: `Tarefa ${n}`,
    createdAt: at,
    responsibleParticipationId: toParticipationId(
      ulid(600 + n + (organizationId === orgB ? 100 : 0)),
    ),
    responsibleRateCents: 0,
  })
}

const dependencyOf = (
  predecessor: Task,
  successor: Task,
  organizationId: TaskDependency['organizationId'] = orgA,
): TaskDependency => ({
  organizationId,
  predecessorId: predecessor.id,
  successorId: successor.id,
  createdAt: at,
  createdBy: userA,
})

/** Pessoas, projetos e tarefas das duas organizações (A: três tarefas no projeto; B: uma). */
async function seed(repos: TaskDependencyRepositoryContractAdapters) {
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
  const first = aTask(1, projectA, orgA)
  const second = aTask(2, projectA, orgA)
  const third = aTask(3, projectA, orgA)
  await repos.tasks.save(orgA, first)
  await repos.tasks.save(orgA, second)
  await repos.tasks.save(orgA, third)
  const other = aTask(1, projectB, orgB)
  await repos.tasks.save(orgB, other)
  return { first, second, third, other }
}

export function describeTaskDependencyRepositoryContract(
  name: string,
  makeAdapters: () => TaskDependencyRepositoryContractAdapters,
): void {
  describe(`contrato dos repositórios de dependências: ${name}`, () => {
    it('grava, lista por projeto (pela sucessora) e por tarefa, e remove', async () => {
      const repos = makeAdapters()
      const { first, second, third } = await seed(repos)
      const ab = dependencyOf(first, second)
      const bc = dependencyOf(second, third)
      await repos.taskDependencies.add(orgA, ab)
      await repos.taskDependencies.add(orgA, bc)

      const byProject = await repos.taskDependencies.listByProject(orgA, projectA)
      expect(byProject.map((d) => [d.predecessorId, d.successorId]).sort()).toEqual(
        [
          [first.id, second.id],
          [second.id, third.id],
        ].sort(),
      )
      await expect(repos.taskDependencies.listByProject(orgA, projectA2)).resolves.toEqual([])

      const byTask = await repos.taskDependencies.listByTask(orgA, second.id)
      expect(byTask).toHaveLength(2)
      await expect(repos.taskDependencies.listByTask(orgA, first.id)).resolves.toEqual([ab])

      await repos.taskDependencies.remove(orgA, first.id, second.id)
      await expect(repos.taskDependencies.listByProject(orgA, projectA)).resolves.toEqual([bc])
    })

    it('recusa duplicata da mesma dupla com CONFLITO, sem gravar a segunda', async () => {
      const repos = makeAdapters()
      const { first, second } = await seed(repos)
      const ab = dependencyOf(first, second)
      await repos.taskDependencies.add(orgA, ab)
      await expect(repos.taskDependencies.add(orgA, ab)).rejects.toThrow(ConflictError)
      await expect(repos.taskDependencies.listByTask(orgA, first.id)).resolves.toHaveLength(1)
    })

    it('isola por organização: a outra organização não lê as dependências', async () => {
      const repos = makeAdapters()
      const { first, second } = await seed(repos)
      await repos.taskDependencies.add(orgA, dependencyOf(first, second))
      await expect(repos.taskDependencies.listByProject(orgB, projectA)).resolves.toEqual([])
      await expect(repos.taskDependencies.listByTask(orgB, first.id)).resolves.toEqual([])
    })

    it('recusa tarefa de outra organização com VALIDAÇÃO e não grava nada', async () => {
      const repos = makeAdapters()
      const { first, other } = await seed(repos)
      await expect(
        repos.taskDependencies.add(orgA, dependencyOf(first, other, orgA)),
      ).rejects.toThrow(ValidationError)
      await expect(
        repos.taskDependencies.add(orgB, dependencyOf(other, first, orgB)),
      ).rejects.toThrow(ValidationError)
      await expect(repos.taskDependencies.listByTask(orgA, first.id)).resolves.toEqual([])
    })

    it('remover o que não existe não faz nada, e remover em outra organização não apaga', async () => {
      const repos = makeAdapters()
      const { first, second } = await seed(repos)
      const ab = dependencyOf(first, second)
      await repos.taskDependencies.add(orgA, ab)
      await expect(
        repos.taskDependencies.remove(orgA, second.id, first.id),
      ).resolves.toBeUndefined()
      await repos.taskDependencies.remove(orgB, first.id, second.id)
      await expect(repos.taskDependencies.listByProject(orgA, projectA)).resolves.toEqual([ab])
    })
  })
}
