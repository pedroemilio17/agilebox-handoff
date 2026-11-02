import { describe, expect, it } from 'vitest'
import {
  parseDateOnly,
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
  ProjectMember,
  ProjectRepository,
  TaskOpenRepository,
  TaskRepository,
  TeamModuleEventRepository,
  TeamModuleRepository,
  TeamSettingsRepository,
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

    it('grava e recupera archivedAt de tarefa e projeto', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const archivedProject = {
        ...aProject()
          .with({
            id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FBB'),
            organizationId,
            name: 'Projeto arquivado',
          })
          .build(),
        archivedAt: '2026-01-05T00:00:00.000Z',
      }
      const archivedTask = {
        ...aTask()
          .with({
            id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FBC'),
            responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FBD'),
            organizationId,
          })
          .inProject(archivedProject)
          .build(),
        archivedAt: '2026-01-06T00:00:00.000Z',
      }
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, archivedProject)
      await repositories.tasks.save(organizationId, archivedTask)

      await expect(
        repositories.projects.findById(organizationId, archivedProject.id),
      ).resolves.toEqual(archivedProject)
      await expect(repositories.tasks.findById(organizationId, archivedTask.id)).resolves.toEqual(
        archivedTask,
      )
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

    it('conta tarefas, participações e reuniões por organização', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      const contributor = aContributor().with({ organizationId }).build()
      const task = aTask().with({ id: taskId, organizationId }).build()
      const participation = aParticipation(task)
        .with({ participant: { kind: 'contributor', contributorId: contributor.id } })
        .build()
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      await repositories.contributors.save(organizationId, contributor)
      await repositories.tasks.save(organizationId, task)
      await repositories.participations.save(organizationId, participation)
      await repositories.meetings.save(organizationId, aMeeting().with({ organizationId }).build())

      await expect(repositories.tasks.count(organizationId)).resolves.toBe(1)
      // A participação explícita e a de responsável que a tarefa já traz.
      await expect(repositories.participations.count(organizationId)).resolves.toBe(2)
      await expect(repositories.meetings.count(organizationId)).resolves.toBe(1)
      await expect(repositories.tasks.count(otherOrganizationId)).resolves.toBe(0)
      await expect(repositories.participations.count(otherOrganizationId)).resolves.toBe(0)
      await expect(repositories.meetings.count(otherOrganizationId)).resolves.toBe(0)
    })

    it('nenhuma leitura de porta devolve dado de outra organização (M1.11)', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      const contributor = aContributor().with({ organizationId }).build()
      const task = aTask()
        .with({ id: taskId, organizationId, createdBy: userId, title: 'Tarefa isolada' })
        .inProject(project)
        .build()
      const participation = aParticipation(task)
        .with({ participant: { kind: 'contributor', contributorId: contributor.id } })
        .build()
      const meeting = aMeeting().with({ organizationId }).build()
      const member: ProjectMember = { projectId, userId, addedBy: userId, addedAt: timestamp }
      const event: TimelineEvent = {
        id: toEventId('01ARZ3NDEKTSV4RRFFQ69G5FB5'),
        taskId,
        at: timestamp,
        actorUserId: userId,
        asManager: false,
        type: 'task_created',
        payload: {},
      }
      const today = parseDateOnly('2026-01-01')

      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      await repositories.projects.addMember(organizationId, member)
      await repositories.contributors.save(organizationId, contributor)
      await repositories.tasks.save(organizationId, task)
      await repositories.participations.save(organizationId, participation)
      await repositories.meetings.save(organizationId, meeting)
      await repositories.timeline.saveMany(organizationId, [event])
      await repositories.taskOpens.recordOpen(organizationId, taskId, userId, timestamp)

      // Controle positivo: a organização que gravou enxerga os registros, então o vazio abaixo não é acidente.
      await expect(repositories.users.list(organizationId)).resolves.not.toHaveLength(0)
      await expect(
        repositories.projects.findByNameKey(organizationId, project.nameKey),
      ).resolves.toEqual(project)
      await expect(repositories.projects.listMembers(organizationId, projectId)).resolves.toEqual([
        member,
      ])
      await expect(repositories.contributors.list(organizationId)).resolves.not.toHaveLength(0)
      await expect(
        repositories.tasks.listByProject(organizationId, projectId),
      ).resolves.not.toHaveLength(0)
      await expect(repositories.tasks.listRecent(organizationId, userId)).resolves.not.toHaveLength(
        0,
      )
      await expect(
        repositories.participations.listByTask(organizationId, taskId),
      ).resolves.not.toHaveLength(0)
      await expect(
        repositories.meetings.listByMonth(organizationId, '2026-01'),
      ).resolves.not.toHaveLength(0)
      await expect(
        repositories.meetings.listUpcoming(organizationId, today),
      ).resolves.not.toHaveLength(0)
      await expect(
        repositories.timeline.listByTask(organizationId, taskId),
      ).resolves.not.toHaveLength(0)

      const other = otherOrganizationId
      await expect(repositories.users.findById(other, user.id)).resolves.toBeNull()
      await expect(repositories.users.list(other)).resolves.toEqual([])
      await expect(repositories.projects.findById(other, projectId)).resolves.toBeNull()
      await expect(repositories.projects.findByNameKey(other, project.nameKey)).resolves.toBeNull()
      await expect(repositories.projects.list(other)).resolves.toEqual([])
      await expect(repositories.projects.listMembers(other, projectId)).resolves.toEqual([])
      await expect(repositories.contributors.findById(other, contributor.id)).resolves.toBeNull()
      await expect(repositories.contributors.list(other)).resolves.toEqual([])
      await expect(repositories.tasks.findById(other, taskId)).resolves.toBeNull()
      await expect(
        repositories.tasks.findByProjectNameKey(other, projectId, 'tarefa isolada'),
      ).resolves.toBeNull()
      await expect(repositories.tasks.listByProject(other, projectId)).resolves.toEqual([])
      await expect(repositories.tasks.listBoard(other, {})).resolves.toEqual([])
      await expect(repositories.tasks.listBoard(other, { projectId })).resolves.toEqual([])
      await expect(repositories.tasks.listBoard(other, { userId })).resolves.toEqual([])
      await expect(repositories.tasks.listRecent(other, userId)).resolves.toEqual([])
      await expect(repositories.tasks.listFrequent(other, userId)).resolves.toEqual([])
      await expect(repositories.tasks.search(other, 'isolada', userId)).resolves.toEqual([])
      await expect(
        repositories.participations.findById(other, participation.id),
      ).resolves.toBeNull()
      await expect(repositories.participations.listByTask(other, taskId)).resolves.toEqual([])
      await expect(repositories.meetings.findById(other, meeting.id)).resolves.toBeNull()
      await expect(repositories.meetings.listByMonth(other, '2026-01')).resolves.toEqual([])
      await expect(repositories.meetings.listUpcoming(other, today)).resolves.toEqual([])
      await expect(repositories.timeline.listByTask(other, taskId)).resolves.toEqual([])
      await expect(repositories.tasks.count(other)).resolves.toBe(0)
      await expect(repositories.participations.count(other)).resolves.toBe(0)
      await expect(repositories.meetings.count(other)).resolves.toBe(0)
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
  })
}

export interface TeamRepositoryContractAdapters {
  readonly teamModuleEvents: TeamModuleEventRepository
  readonly teamModules: TeamModuleRepository
  readonly teamSettings: TeamSettingsRepository
}

const changedAt = '2026-01-03T00:00:00.000Z'

export function describeTeamRepositoryContract(
  name: string,
  makeAdapters: () => TeamRepositoryContractAdapters,
): void {
  describe(`contrato dos repositórios de time: ${name}`, () => {
    it('grava módulos do time e lista na ordem do catálogo, substituindo o mesmo módulo', async () => {
      const { teamModules } = makeAdapters()
      const base = { state: 'active' as const, config: {}, changedBy: userId, changedAt }
      await teamModules.save(organizationId, { ...base, moduleId: 'sprints' })
      await teamModules.save(organizationId, { ...base, moduleId: 'agenda' })
      await teamModules.save(organizationId, {
        ...base,
        moduleId: 'sprints',
        state: 'winding_down',
        config: { maxActive: 1 },
      })

      await expect(teamModules.list(organizationId)).resolves.toEqual([
        { ...base, moduleId: 'agenda' },
        { ...base, moduleId: 'sprints', state: 'winding_down', config: { maxActive: 1 } },
      ])
    })

    it('isola módulos do time por organização', async () => {
      const { teamModules } = makeAdapters()
      await teamModules.save(organizationId, {
        moduleId: 'agenda',
        state: 'active',
        config: {},
        changedBy: userId,
        changedAt,
      })

      await expect(teamModules.list(otherOrganizationId)).resolves.toEqual([])
    })

    it('acrescenta eventos do histórico, lista em ordem cronológica e isola por organização', async () => {
      const { teamModuleEvents } = makeAdapters()
      const later = {
        id: '00000000000000000000000002',
        moduleId: 'sprints' as const,
        fromState: 'active' as const,
        toState: 'disabled' as const,
        changedBy: userId,
        changedAt: '2026-01-05T00:00:00.000Z',
      }
      const earlier = { ...later, id: '00000000000000000000000001', changedAt: changedAt }
      await teamModuleEvents.append(organizationId, later)
      await teamModuleEvents.append(organizationId, earlier)

      await expect(teamModuleEvents.list(organizationId)).resolves.toEqual([earlier, later])
      await expect(teamModuleEvents.list(otherOrganizationId)).resolves.toEqual([])
    })

    it('grava, relê e substitui as preferências do time, sem configuração devolve null', async () => {
      const { teamSettings } = makeAdapters()
      await expect(teamSettings.find(organizationId)).resolves.toBeNull()

      await teamSettings.save(organizationId, { level: 'basic', changedBy: userId, changedAt })
      await teamSettings.save(organizationId, {
        level: 'advanced',
        changedBy: userId,
        changedAt: '2026-01-04T00:00:00.000Z',
      })

      await expect(teamSettings.find(organizationId)).resolves.toEqual({
        level: 'advanced',
        changedBy: userId,
        changedAt: '2026-01-04T00:00:00.000Z',
      })
      await expect(teamSettings.find(otherOrganizationId)).resolves.toBeNull()
    })
  })
}
