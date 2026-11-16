import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  createTask,
  openImpediment,
  toParticipationId,
  resolveImpediment,
  toImpedimentId,
  toOrganizationId,
  toProjectId,
  toTaskId,
  toUserId,
  assignImpediment,
} from '@agilebox/core'
import type { Impediment, Project, Task, User } from '@agilebox/core'
import type {
  ImpedimentRepository,
  ProjectRepository,
  TaskRepository,
  UserRepository,
} from '../ports'
import { aProject, aUser } from './builders'

/** Tarefa com participação de id próprio (o builder reaproveita o id e colide entre tarefas). */
function aTaskFor(
  organizationId: Task['organizationId'],
  projectIdValue: Task['projectId'],
  number: number,
  id: Task['id'],
  createdBy: Task['createdBy'],
): Task {
  return createTask({
    id,
    organizationId,
    number,
    projectId: projectIdValue,
    projectName: 'Projeto',
    createdBy,
    title: `Tarefa ${number}`,
    createdAt: at,
    responsibleParticipationId: toParticipationId(ulid(600 + Number(id.slice(-2)))),
    responsibleRateCents: 0,
  })
}

export interface ImpedimentRepositoryContractAdapters {
  readonly impediments: ImpedimentRepository
  readonly projects: ProjectRepository
  readonly tasks: TaskRepository
  readonly users: UserRepository
}

/** Identificadores válidos (ULID) de teste: 26 caracteres, todos dígitos. */
const ulid = (n: number) => String(n).padStart(26, '0')
const orgA = toOrganizationId(ulid(1))
const orgB = toOrganizationId(ulid(2))
const ana = toUserId(ulid(10))
const bia = toUserId(ulid(11))
const projectId = toProjectId(ulid(20))
const taskOne = toTaskId(ulid(30))
const taskTwo = toTaskId(ulid(31))
const bob = toUserId(ulid(12))
const projectB = toProjectId(ulid(21))
const taskB = toTaskId(ulid(32))
const at = '2026-03-02T09:00:00.000Z'
const later = '2026-03-05T09:00:00.000Z'

function anImpediment(
  id: number,
  taskId = taskOne,
  openedAt = at,
  organizationId = orgA,
): Impediment {
  return openImpediment({
    id: toImpedimentId(ulid(400 + id)),
    organizationId,
    taskId,
    reason: `Motivo ${id}`,
    ownerId: null,
    openedBy: ana,
    openedAt,
  })
}

export function describeImpedimentRepositoryContract(
  name: string,
  makeAdapters: () => ImpedimentRepositoryContractAdapters,
): void {
  describe(`contrato dos repositórios de impedimento: ${name}`, () => {
    async function seed(repos: ImpedimentRepositoryContractAdapters) {
      const users: User[] = [
        aUser()
          .with({ id: ana, organizationId: orgA, name: 'Ana', email: 'ana@contrato.test' })
          .build(),
        aUser()
          .with({ id: bia, organizationId: orgA, name: 'Bia', email: 'bia@contrato.test' })
          .build(),
      ]
      for (const user of users) await repos.users.save(orgA, user)
      const project: Project = aProject()
        .with({ id: projectId, organizationId: orgA, createdBy: ana })
        .build()
      await repos.projects.save(orgA, project)
      await repos.users.save(
        orgB,
        aUser()
          .with({ id: bob, organizationId: orgB, name: 'Bob', email: 'bob@contrato.test' })
          .build(),
      )
      await repos.projects.save(
        orgB,
        aProject().with({ id: projectB, organizationId: orgB, createdBy: bob }).build(),
      )
      const tasks: Task[] = [
        aTaskFor(orgA, projectId, 1, taskOne, ana),
        aTaskFor(orgA, projectId, 2, taskTwo, ana),
        aTaskFor(orgB, projectB, 1, taskB, bob),
      ]
      for (const task of tasks) await repos.tasks.save(task.organizationId, task)
    }

    it('grava e recupera por id, com o histórico na ordem de abertura', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const first = anImpediment(1)
      const resolvedFirst = resolveImpediment(first, ana, later, 'Liberado')
      await repos.impediments.save(orgA, resolvedFirst)
      const second = anImpediment(2, taskOne, later)
      await repos.impediments.save(orgA, second)

      await expect(repos.impediments.findById(orgA, first.id)).resolves.toEqual(resolvedFirst)
      const history = await repos.impediments.listByTask(orgA, taskOne)
      expect(history.map((row) => row.id)).toEqual([first.id, second.id])
      await expect(repos.impediments.findOpenByTask(orgA, taskOne)).resolves.toEqual(second)
    })

    it('no máximo um aberto por tarefa: o segundo aberto é recusado, mas depois de resolver cabe outro', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const open = anImpediment(3)
      await repos.impediments.save(orgA, open)
      await expect(repos.impediments.save(orgA, anImpediment(4))).rejects.toThrow(ConflictError)

      await repos.impediments.save(orgA, resolveImpediment(open, ana, later, null))
      await expect(
        repos.impediments.save(orgA, anImpediment(5, taskOne, later)),
      ).resolves.toBeUndefined()
    })

    it('atribuir responsável grava o novo e lista só os abertos por padrão', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const open = anImpediment(6)
      const other = anImpediment(7, taskTwo, later)
      await repos.impediments.save(orgA, open)
      await repos.impediments.save(orgA, other)
      await repos.impediments.save(orgA, assignImpediment(open, bia))
      await repos.impediments.save(orgA, resolveImpediment(other, ana, later, 'Ok'))

      const openOnly = await repos.impediments.listByOrganization(orgA, { includeResolved: false })
      expect(openOnly.map((row) => row.id)).toEqual([open.id])
      expect(openOnly[0]?.ownerId).toBe(bia)
      const all = await repos.impediments.listByOrganization(orgA, { includeResolved: true })
      expect(all).toHaveLength(2)
      const byOwner = await repos.impediments.listByOrganization(orgA, {
        includeResolved: true,
        ownerId: bia,
      })
      expect(byOwner.map((row) => row.id)).toEqual([open.id])
    })

    it('lote de abertos por tarefas, contagem total e isolamento por organização', async () => {
      const repos = makeAdapters()
      await seed(repos)
      await repos.impediments.save(orgA, anImpediment(8))
      await repos.impediments.save(orgB, anImpediment(9, taskB, at, orgB))

      const open = await repos.impediments.listOpenByTasks(orgA, [taskOne, taskTwo])
      expect(open.map((row) => row.taskId)).toEqual([taskOne])
      expect(await repos.impediments.listOpenByTasks(orgA, [])).toEqual([])
      expect(await repos.impediments.countByOrganization(orgA)).toBe(1)
      expect(await repos.impediments.findById(orgB, anImpediment(9).id)).not.toBeNull()
      expect(await repos.impediments.findById(orgA, anImpediment(9).id)).toBeNull()
      expect(await repos.impediments.listOpenByTasks(orgB, [taskB])).toHaveLength(1)
      expect(await repos.impediments.countByOrganization(orgB)).toBe(1)
    })

    it('outra organização não regrava o impedimento de quem é dona', async () => {
      const repos = makeAdapters()
      await seed(repos)
      const open = anImpediment(10)
      await repos.impediments.save(orgA, open)
      await repos.impediments.save(orgB, resolveImpediment(open, ana, later, 'Invasão'))
      expect(await repos.impediments.findById(orgA, open.id)).toEqual(open)
    })
  })
}
