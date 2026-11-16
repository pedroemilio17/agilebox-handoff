import { describe, expect, it } from 'vitest'
import {
  renameTask,
  toEventId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { TimelineEvent } from '@agilebox/core'
import type {
  ContributorRepository,
  MeetingRepository,
  ParticipationRepository,
  ProjectRepository,
  TaskOpenRepository,
  TaskRepository,
  TimelineRepository,
  UserRepository,
} from '../ports'
import { aContributor, aMeeting, aParticipation, aProject, aTask, aUser } from './builders'

export interface RepositoryContractAdapters {
  readonly contributors: ContributorRepository
  readonly meetings: MeetingRepository
  readonly participations: ParticipationRepository
  readonly projects: ProjectRepository
  readonly taskOpens: TaskOpenRepository
  readonly tasks: TaskRepository
  readonly timeline: TimelineRepository
  readonly users: UserRepository
}

const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
const otherOrganizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
const userId = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX')
const projectId = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FAY')
const taskId = toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FAZ')
const timestamp = '2026-01-01T00:00:00.000Z'

export function describeRepositoryContract(
  name: string,
  makeAdapters: () => RepositoryContractAdapters,
): void {
  describe(`contrato dos repositórios: ${name}`, () => {
    it('grava e recupera registros por identificador', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      const contributor = aContributor().with({ organizationId }).build()
      const task = aTask().with({ id: taskId, organizationId }).build()
      const participationTask = aTask()
        .with({
          id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB8'),
          number: 2,
          responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FB9'),
          organizationId,
        })
        .build()
      const participation = aParticipation(participationTask)
        .with({ participant: { kind: 'contributor', contributorId: contributor.id } })
        .build()
      const meeting = aMeeting().with({ organizationId }).build()
      const event: TimelineEvent = {
        id: toEventId('01ARZ3NDEKTSV4RRFFQ69G5FB0'),
        taskId,
        at: timestamp,
        actorUserId: userId,
        asManager: false,
        type: 'task_created',
        payload: {},
      }

      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      await repositories.contributors.save(organizationId, contributor)
      await repositories.tasks.save(organizationId, task)
      await repositories.tasks.save(organizationId, participationTask)
      await repositories.participations.save(organizationId, participation)
      await repositories.meetings.save(organizationId, meeting)
      const laterEvent: TimelineEvent = {
        ...event,
        id: toEventId('01ARZ3NDEKTSV4RRFFQ69G5FB4'),
        at: '2026-01-02T00:00:00.000Z',
      }
      await repositories.timeline.saveMany(organizationId, [event, laterEvent])

      await expect(repositories.users.findById(organizationId, user.id)).resolves.toEqual(user)
      await expect(repositories.projects.findById(organizationId, project.id)).resolves.toEqual(
        project,
      )
      await expect(
        repositories.contributors.findById(organizationId, contributor.id),
      ).resolves.toEqual(contributor)
      await expect(repositories.tasks.findById(organizationId, task.id)).resolves.toEqual(task)
      await expect(
        repositories.participations.findById(organizationId, participation.id),
      ).resolves.toEqual(participation)
      await expect(repositories.meetings.findById(organizationId, meeting.id)).resolves.toEqual(
        meeting,
      )
      await expect(repositories.timeline.listByTask(organizationId, task.id)).resolves.toEqual([
        laterEvent,
        event,
      ])
    })

    it('ordena Recentes e Frequentes e busca sem acentos', async () => {
      const repositories = makeAdapters()
      const older = renameTask(
        aTask()
          .with({
            id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB1'),
            responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FB6'),
            organizationId,
            createdBy: userId,
            createdAt: '2026-01-01T00:00:00.000Z',
          })
          .build(),
        'Café da manhã',
      )
      const newer = renameTask(
        aTask()
          .with({
            id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB2'),
            number: 2,
            responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FB7'),
            organizationId,
            createdBy: userId,
            createdAt: '2026-01-03T00:00:00.000Z',
          })
          .build(),
        'Revisão semanal',
      )
      const olderRecent = { ...older, updatedAt: '2026-01-02T00:00:00.000Z' }
      const newerRecent = { ...newer, updatedAt: '2026-01-04T00:00:00.000Z' }
      await repositories.tasks.save(organizationId, olderRecent)
      await repositories.tasks.save(organizationId, newerRecent)
      await repositories.taskOpens.recordOpen(organizationId, older.id, userId, timestamp)
      await repositories.taskOpens.recordOpen(organizationId, newer.id, userId, timestamp)
      await repositories.taskOpens.recordOpen(organizationId, newer.id, userId, timestamp)

      await expect(repositories.tasks.listRecent(organizationId, userId)).resolves.toEqual([
        newerRecent,
        olderRecent,
      ])
      await expect(repositories.tasks.listFrequent(organizationId, userId)).resolves.toEqual([
        newerRecent,
        olderRecent,
      ])
      await expect(repositories.tasks.search(organizationId, 'cafe', userId)).resolves.toEqual([
        olderRecent,
      ])
    })

    it('mantém nomes únicos dentro da organização e permite o mesmo nome em outra', async () => {
      const repositories = makeAdapters()
      const project = aProject().with({ id: projectId, organizationId }).build()
      const sameNameElsewhere = aProject()
        .with({
          id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB3'),
          organizationId: otherOrganizationId,
        })
        .build()
      await repositories.projects.save(organizationId, project)
      await repositories.projects.save(otherOrganizationId, sameNameElsewhere)

      await expect(
        repositories.projects.findByNameKey(organizationId, project.nameKey),
      ).resolves.toEqual(project)
      await expect(
        repositories.projects.findByNameKey(otherOrganizationId, project.nameKey),
      ).resolves.toEqual(sameNameElsewhere)
    })

    it('isola leituras e listagens entre organizações', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      await repositories.users.save(organizationId, user)

      await expect(repositories.users.findById(otherOrganizationId, user.id)).resolves.toBeNull()
      await expect(repositories.users.list(otherOrganizationId)).resolves.toEqual([])
    })

    it('não regrava, por identificador, registro de outra organização', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId, name: 'Ana' }).build()
      const project = aProject().with({ id: projectId, organizationId, name: 'Projeto A' }).build()
      const contributor = aContributor().with({ organizationId }).build()
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      await repositories.contributors.save(organizationId, contributor)

      // Mesmos identificadores, gravados pela organização B: nada de A pode mudar.
      await repositories.users.save(otherOrganizationId, { ...user, name: 'Intrusa' })
      await repositories.projects.save(otherOrganizationId, { ...project, name: 'Intruso' })
      await repositories.contributors.save(otherOrganizationId, {
        ...contributor,
        name: 'Intruso',
      })

      await expect(repositories.users.findById(organizationId, user.id)).resolves.toEqual(user)
      await expect(repositories.projects.findById(organizationId, project.id)).resolves.toEqual(
        project,
      )
      await expect(
        repositories.contributors.findById(organizationId, contributor.id),
      ).resolves.toEqual(contributor)
      await expect(repositories.users.findById(otherOrganizationId, user.id)).resolves.toBeNull()
      await expect(
        repositories.projects.findById(otherOrganizationId, project.id),
      ).resolves.toBeNull()
    })

    it('remove registros removíveis do contrato', async () => {
      const repositories = makeAdapters()
      const meeting = aMeeting().with({ organizationId }).build()
      const task = aTask().with({ id: taskId, organizationId }).build()
      const participation = aParticipation(task).build()
      await repositories.meetings.save(organizationId, meeting)
      await repositories.participations.save(organizationId, participation)

      await repositories.meetings.remove(organizationId, meeting.id)
      await repositories.participations.remove(organizationId, participation.id)

      await expect(repositories.meetings.findById(organizationId, meeting.id)).resolves.toBeNull()
      await expect(
        repositories.participations.findById(organizationId, participation.id),
      ).resolves.toBeNull()
    })
    it('lista só os itens de backlog do projeto e grava as posições pedidas, por organização', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      const backlogTask = (suffix: string, backlogRank: number | null, createdAt = timestamp) => ({
        ...aTask()
          .with({
            id: toTaskId(`01ARZ3NDEKTSV4RRFFQ69G${suffix}`),
            number: 900 + (suffix.charCodeAt(3) - 48),
            responsibleParticipationId: toParticipationId(
              `01ARZ3NDEKTSV4RRFFQ69G${suffix.replace(/^./u, 'D')}`,
            ),
            organizationId,
            projectId,
            createdBy: userId,
            createdAt,
          })
          .build(),
        backlogRank,
      })
      const first = backlogTask('5CA1', 2048)
      const second = backlogTask('5CA2', 1024)
      const onBoard = backlogTask('5CA3', null)
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      await repositories.tasks.save(organizationId, first)
      await repositories.tasks.save(organizationId, second)
      await repositories.tasks.save(organizationId, onBoard)

      await expect(repositories.tasks.findById(organizationId, first.id)).resolves.toEqual(first)
      const backlog = await repositories.tasks.listBacklog(organizationId, projectId)
      expect(backlog.map((task) => task.id).sort()).toEqual([first.id, second.id].sort())

      await repositories.tasks.updateBacklogRanks(organizationId, [
        { taskId: second.id, backlogRank: 4096 },
      ])
      await expect(repositories.tasks.findById(organizationId, second.id)).resolves.toEqual({
        ...second,
        backlogRank: 4096,
      })
      await expect(repositories.tasks.findById(organizationId, first.id)).resolves.toEqual(first)
      await expect(repositories.tasks.findById(organizationId, onBoard.id)).resolves.toEqual(
        onBoard,
      )

      // Outra organização não vê o backlog daqui nem consegue regravar a posição.
      await expect(repositories.tasks.listBacklog(otherOrganizationId, projectId)).resolves.toEqual(
        [],
      )
      await repositories.tasks.updateBacklogRanks(otherOrganizationId, [
        { taskId: first.id, backlogRank: 1 },
      ])
      await expect(repositories.tasks.findById(organizationId, first.id)).resolves.toEqual(first)
    })
  })
}
