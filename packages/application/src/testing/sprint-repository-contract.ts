import { describe, expect, it } from 'vitest'
import {
  closeSprintTask,
  createSprint,
  createSprintTask,
  createTask,
  startSprint,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toSprintId,
  toTaskId,
  toUserId,
  ConflictError,
} from '@agilebox/core'
import type { Project, Sprint, Task, User } from '@agilebox/core'
import type {
  ProjectRepository,
  SprintRepository,
  SprintTaskRepository,
  TaskRepository,
  UserRepository,
} from '../ports'
import { aProject, aUser } from './builders'

export interface SprintRepositoryContractAdapters {
  readonly projects: ProjectRepository
  readonly sprints: SprintRepository
  readonly sprintTasks: SprintTaskRepository
  readonly tasks: TaskRepository
  readonly users: UserRepository
}

/** Identificadores válidos (ULID) de teste: 26 caracteres, todos dígitos. */
const ulid = (n: number) => String(n).padStart(26, '0')
const orgA = toOrganizationId(ulid(1))
const orgB = toOrganizationId(ulid(2))
const userId = toUserId(ulid(10))
const projectId = toProjectId(ulid(20))
const otherProjectId = toProjectId(ulid(21))
const at = '2026-03-02T09:00:00.000Z'
const later = '2026-03-05T09:00:00.000Z'

function aSprintFor(
  organizationId: Sprint['organizationId'],
  projectIdValue: Sprint['projectId'],
  number: number,
  id: number,
): Sprint {
  return createSprint({
    id: toSprintId(ulid(300 + id)),
    organizationId,
    projectId: projectIdValue,
    number,
    name: '',
    goal: null,
    plannedStart: '2026-03-02',
    plannedEnd: '2026-03-13',
    createdBy: userId,
    createdAt: at,
  })
}

function aTaskFor(
  organizationId: Task['organizationId'],
  projectIdValue: Task['projectId'],
  n: number,
) {
  return createTask({
    id: toTaskId(ulid(400 + n)),
    organizationId,
    number: n,
    projectId: projectIdValue,
    projectName: 'Projeto',
    createdBy: userId,
    title: `Tarefa ${n}`,
    createdAt: at,
    responsibleParticipationId: toParticipationId(ulid(500 + n)),
    responsibleRateCents: 4500,
  })
}

export function describeSprintRepositoryContract(
  name: string,
  makeAdapters: () => SprintRepositoryContractAdapters,
): void {
  describe(`contrato dos repositórios de sprint: ${name}`, () => {
    async function seed(repos: SprintRepositoryContractAdapters) {
      const user: User = aUser().with({ id: userId, organizationId: orgA }).build()
      const projectA: Project = aProject()
        .with({ id: projectId, organizationId: orgA, createdBy: userId })
        .build()
      const projectB: Project = aProject()
        .with({ id: otherProjectId, organizationId: orgA, name: 'Outro', createdBy: userId })
        .build()
      await repos.users.save(orgA, user)
      await repos.projects.save(orgA, projectA)
      await repos.projects.save(orgA, projectB)
      const otherUser = aUser()
        .with({ id: toUserId(ulid(11)), organizationId: orgB })
        .build()
      const otherProject = aProject()
        .with({ id: toProjectId(ulid(22)), organizationId: orgB, createdBy: toUserId(ulid(11)) })
        .build()
      await repos.users.save(orgB, otherUser)
      await repos.projects.save(orgB, otherProject)
    }

    it('grava e recupera sprints por id, em ordem de número, e filtra por estado', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const first = aSprintFor(orgA, projectId, 1, 1)
      const second = aSprintFor(orgA, projectId, 2, 2)
      await repos.sprints.save(orgA, second)
      await repos.sprints.save(orgA, first)

      await expect(repos.sprints.findById(orgA, first.id)).resolves.toEqual(first)
      const all = await repos.sprints.listByProject(orgA, projectId)
      expect(all.map((sprint) => sprint.number)).toEqual([1, 2])

      const active = startSprint(first, at, 0, 1)
      await repos.sprints.save(orgA, active)
      expect(
        (await repos.sprints.listByProject(orgA, projectId, 'active')).map((sprint) => sprint.id),
      ).toEqual([active.id])
      expect(
        (await repos.sprints.listByProject(orgA, projectId, 'draft')).map((sprint) => sprint.id),
      ).toEqual([second.id])
      await expect(repos.sprints.countActive(orgA, projectId)).resolves.toBe(1)
      // Outro projeto não entra na lista deste.
      await expect(repos.sprints.listByProject(orgA, otherProjectId)).resolves.toEqual([])
    })

    it('numera em sequência por projeto e nunca reaproveita o número de uma sprint descartada', async () => {
      const repos = makeAdapters()
      await seed(repos)
      await expect(repos.sprints.nextNumber(orgA, projectId)).resolves.toBe(1)
      const draft = aSprintFor(orgA, projectId, 1, 3)
      await repos.sprints.save(orgA, draft)
      await expect(repos.sprints.nextNumber(orgA, projectId)).resolves.toBe(2)

      await repos.sprints.markDiscarded(orgA, draft.id, later, userId)
      // Descartada some das leituras, mas o número continua ocupado.
      await expect(repos.sprints.findById(orgA, draft.id)).resolves.toBeNull()
      await expect(repos.sprints.listByProject(orgA, projectId)).resolves.toEqual([])
      await expect(repos.sprints.nextNumber(orgA, projectId)).resolves.toBe(2)
      // Outro projeto começa do 1.
      await expect(repos.sprints.nextNumber(orgA, otherProjectId)).resolves.toBe(1)
    })

    it('descarte não apaga a sprint: salvar de novo não a traz de volta, e o descarte não se desfaz', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const draft = aSprintFor(orgA, projectId, 1, 4)
      await repos.sprints.save(orgA, draft)
      await repos.sprints.markDiscarded(orgA, draft.id, later, userId)
      await repos.sprints.save(orgA, { ...draft, name: 'Renomeada' })
      await expect(repos.sprints.findById(orgA, draft.id)).resolves.toBeNull()
    })

    it('mantém o histórico de tarefas: sai da sprint fecha a linha, e a linha aberta é única por tarefa', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const sprint = aSprintFor(orgA, projectId, 1, 5)
      await repos.sprints.save(orgA, sprint)
      const task = aTaskFor(orgA, projectId, 1)
      const other = aTaskFor(orgA, projectId, 2)
      await repos.tasks.save(orgA, task)
      await repos.tasks.save(orgA, other)

      const row = createSprintTask({
        sprintId: sprint.id,
        organizationId: orgA,
        taskId: task.id,
        addedAt: at,
        addedBy: userId,
      })
      await repos.sprintTasks.saveRows(orgA, [row])
      await expect(repos.sprintTasks.listOpenByTasks(orgA, [task.id])).resolves.toEqual([row])

      // Uma segunda linha aberta para a mesma tarefa é recusada, mesmo em outra sprint.
      const elsewhereSprint = aSprintFor(orgA, projectId, 2, 10)
      await repos.sprints.save(orgA, elsewhereSprint)
      const elsewhere = createSprintTask({
        sprintId: elsewhereSprint.id,
        organizationId: orgA,
        taskId: task.id,
        addedAt: later,
        addedBy: userId,
      })
      await expect(repos.sprintTasks.saveRows(orgA, [elsewhere])).rejects.toBeInstanceOf(
        ConflictError,
      )

      const closed = closeSprintTask(row, 'removed', later, userId)
      await repos.sprintTasks.saveRows(orgA, [closed])
      await expect(repos.sprintTasks.listOpenByTasks(orgA, [task.id])).resolves.toEqual([])
      // A linha fechada continua no histórico da sprint e da tarefa.
      await expect(repos.sprintTasks.listBySprint(orgA, sprint.id)).resolves.toEqual([closed])
      await expect(repos.sprintTasks.listByTask(orgA, task.id)).resolves.toEqual([closed])

      // Depois de fechada, a tarefa pode abrir uma linha nova em outra sprint.
      const again = createSprintTask({
        sprintId: sprint.id,
        organizationId: orgA,
        taskId: task.id,
        addedAt: later,
        addedBy: userId,
      })
      await repos.sprintTasks.saveRows(orgA, [again])
      expect((await repos.sprintTasks.listByTask(orgA, task.id)).map((r) => r.outcome)).toEqual([
        'removed',
        'open',
      ])
    })

    it('conta sprints não encerradas e itens abertos nelas, sem descartadas', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const draft = aSprintFor(orgA, projectId, 1, 6)
      const toClose = startSprint(aSprintFor(orgA, projectId, 2, 7), at, 0, 1)
      const discarded = aSprintFor(orgA, projectId, 3, 8)
      await repos.sprints.save(orgA, draft)
      await repos.sprints.save(orgA, toClose)
      await repos.sprints.save(orgA, discarded)
      await repos.sprints.markDiscarded(orgA, discarded.id, later, userId)
      const task = aTaskFor(orgA, projectId, 3)
      await repos.tasks.save(orgA, task)
      await repos.sprintTasks.saveRows(orgA, [
        createSprintTask({
          sprintId: draft.id,
          organizationId: orgA,
          taskId: task.id,
          addedAt: at,
          addedBy: userId,
        }),
      ])
      await expect(repos.sprints.countNotClosed(orgA)).resolves.toBe(2)
      await expect(repos.sprintTasks.countOpenInNotClosed(orgA)).resolves.toBe(1)
    })

    it('isola sprints e histórico entre organizações', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const sprint = aSprintFor(orgA, projectId, 1, 9)
      await repos.sprints.save(orgA, sprint)
      await expect(repos.sprints.findById(orgB, sprint.id)).resolves.toBeNull()
      await expect(repos.sprints.listByProject(orgB, projectId)).resolves.toEqual([])
      await expect(repos.sprints.countActive(orgB, projectId)).resolves.toBe(0)
      await expect(repos.sprints.nextNumber(orgB, projectId)).resolves.toBe(1)
      await expect(repos.sprints.countNotClosed(orgB)).resolves.toBe(0)

      // Outra organização não regrava a sprint daqui nem descarta.
      const forged = { ...sprint, name: 'Invadida' }
      await repos.sprints.save(orgB, forged)
      await repos.sprints.markDiscarded(orgB, sprint.id, later, userId)
      await expect(repos.sprints.findById(orgA, sprint.id)).resolves.toEqual(sprint)

      const task = aTaskFor(orgA, projectId, 4)
      await repos.tasks.save(orgA, task)
      const row = createSprintTask({
        sprintId: sprint.id,
        organizationId: orgA,
        taskId: task.id,
        addedAt: at,
        addedBy: userId,
      })
      await repos.sprintTasks.saveRows(orgB, [row])
      await expect(repos.sprintTasks.listOpenByTasks(orgA, [task.id])).resolves.toEqual([])
      await expect(repos.sprintTasks.listBySprint(orgB, sprint.id)).resolves.toEqual([])
    })
  })
}
