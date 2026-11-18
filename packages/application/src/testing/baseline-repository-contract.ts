import { describe, expect, it } from 'vitest'
import {
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
  toBaselineId,
  parseDateOnly,
  ValidationError,
} from '@agilebox/core'
import type { Baseline, BaselineTask, Project, Task, User } from '@agilebox/core'
import type {
  BaselineRepository,
  ProjectRepository,
  TaskRepository,
  UserRepository,
} from '../ports'
import { aProject, aTask, aUser } from './builders'

export interface BaselineRepositoryContractAdapters {
  readonly projects: ProjectRepository
  readonly users: UserRepository
  readonly tasks: TaskRepository
  readonly baselines: BaselineRepository
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
const taskA = toTaskId(ulid(30))
const taskA2 = toTaskId(ulid(31))
const taskB = toTaskId(ulid(32))
const earlier = '2026-03-02T09:00:00.000Z'
const later = '2026-03-03T09:00:00.000Z'

function aPlan(
  taskId: BaselineTask['taskId'],
  overrides: Partial<BaselineTask> = {},
): BaselineTask {
  return {
    taskId,
    title: 'Tarefa de teste',
    startsOn: parseDateOnly('2026-03-01'),
    endsOn: parseDateOnly('2026-03-10'),
    estimatedHoursHundredths: 800,
    plannedCostCents: 36000,
    ...overrides,
  }
}

function aBaseline(id: number, overrides: Partial<Baseline> = {}): Baseline {
  return {
    id: toBaselineId(ulid(700 + id)),
    organizationId: orgA,
    projectId: projectA,
    name: `Foto ${id}`,
    takenAt: earlier,
    takenBy: userA,
    tasks: [],
    ...overrides,
  }
}

/** Pessoas, projetos e tarefas das duas organizações (como nos contratos de riscos e entregas). */
async function seed(repos: BaselineRepositoryContractAdapters) {
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
  const tasks: Task[] = [
    aTask()
      .inProject(p1)
      .ownedBy(user)
      .with({
        id: taskA,
        organizationId: orgA,
        number: 1,
        responsibleParticipationId: toParticipationId(ulid(40)),
      })
      .build(),
    aTask()
      .inProject(p1)
      .ownedBy(user)
      .with({
        id: taskA2,
        organizationId: orgA,
        number: 2,
        responsibleParticipationId: toParticipationId(ulid(41)),
      })
      .build(),
    aTask()
      .inProject(pB)
      .ownedBy(otherUser)
      .with({
        id: taskB,
        organizationId: orgB,
        number: 1,
        responsibleParticipationId: toParticipationId(ulid(42)),
      })
      .build(),
  ]
  for (const task of tasks) await repos.tasks.save(task.organizationId, task)
}

/**
 * Suíte de contrato da linha de base (ADR-10, módulo `baseline`). Vale para o fake em memória e para
 * o SQLite. Cada foto é imutável; a mais recente do projeto é a de comparação; e nada cruza a
 * fronteira da organização.
 */
export function describeBaselineRepositoryContract(
  name: string,
  makeAdapters: () => BaselineRepositoryContractAdapters,
) {
  describe(`contrato da linha de base (${name})`, () => {
    it('sem foto, o projeto não tem linha de base', async () => {
      const repos = makeAdapters()
      await seed(repos)
      expect(await repos.baselines.findLatestByProject(orgA, projectA)).toBeNull()
    })

    it('grava a foto com as tarefas e devolve as mesmas linhas, com nulos preservados', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const tasks = [
        aPlan(taskA),
        aPlan(taskA2, { startsOn: null, plannedCostCents: null, estimatedHoursHundredths: null }),
      ]
      await repos.baselines.add(orgA, aBaseline(1, { tasks }))

      const found = await repos.baselines.findLatestByProject(orgA, projectA)
      expect(found).toMatchObject({ id: toBaselineId(ulid(701)), name: 'Foto 1', takenBy: userA })
      const byId = new Map(found?.tasks.map((item) => [item.taskId, item]))
      expect(byId.get(taskA)).toEqual(tasks[0])
      expect(byId.get(taskA2)).toEqual(tasks[1])
    })

    it('a mais recente por data da foto é a de comparação, mesmo gravada antes', async () => {
      const repos = makeAdapters()
      await seed(repos)
      await repos.baselines.add(orgA, aBaseline(2, { takenAt: later, name: 'Nova' }))
      await repos.baselines.add(orgA, aBaseline(1, { takenAt: earlier, name: 'Antiga' }))

      const found = await repos.baselines.findLatestByProject(orgA, projectA)
      expect(found?.name).toBe('Nova')
    })

    it('fotos ficam por projeto: a de um projeto não aparece no outro', async () => {
      const repos = makeAdapters()
      await seed(repos)
      await repos.baselines.add(orgA, aBaseline(1, { projectId: projectA }))
      expect(await repos.baselines.findLatestByProject(orgA, projectA2)).toBeNull()
    })

    it('isolamento: a foto de uma organização não aparece para a outra', async () => {
      const repos = makeAdapters()
      await seed(repos)
      await repos.baselines.add(orgA, aBaseline(1))
      expect(await repos.baselines.findLatestByProject(orgB, projectA)).toBeNull()
    })

    it('recusa projeto de outra organização, gravador e tarefa de outra organização', async () => {
      const repos = makeAdapters()
      await seed(repos)
      await expect(
        repos.baselines.add(orgA, aBaseline(1, { projectId: projectB })),
      ).rejects.toThrow(ValidationError)
      await expect(repos.baselines.add(orgA, aBaseline(2, { takenBy: userB }))).rejects.toThrow(
        ValidationError,
      )
      await expect(
        repos.baselines.add(orgA, aBaseline(3, { tasks: [aPlan(taskB)] })),
      ).rejects.toThrow(ValidationError)
      expect(await repos.baselines.findLatestByProject(orgA, projectA)).toBeNull()
    })
  })
}
