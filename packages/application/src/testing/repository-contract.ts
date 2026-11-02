import { describe, expect, it } from 'vitest'
import {
  parseDateOnly,
  renameTask,
  toAcceptanceCriterionId,
  toEventId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { AcceptanceCriterion, OrganizationId, Task, TimelineEvent } from '@agilebox/core'
import type {
  ContributorRepository,
  MeetingRepository,
  ParticipationRepository,
  ProjectMember,
  ProjectRepository,
  TaskCriteriaRepository,
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
  readonly taskCriteria: TaskCriteriaRepository
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
const otherUserId = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB0')
const otherProjectId = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB1')
const timestamp = '2026-01-01T00:00:00.000Z'

/** ULID válido de 26 caracteres com o prefixo fixo dos testes de contrato (M3.9). */
function ulid(suffix: string): string {
  return `01ARZ3NDEKTSV4RRFFQ69G5F${suffix}`
}

/**
 * Tarefa do time com posição de backlog, arquivamento e estimativa escolhidos (M3.9). A posição
 * e o quadro seguem o invariante: fora do backlog = no quadro.
 */
function aPlacedTask(
  id: string,
  placement: {
    backlogRank?: number | null
    archivedAt?: string | null
    estimatedHours?: number | null
    organization?: OrganizationId
    title?: string
  } = {},
): Task {
  const task = aTask()
    .with({
      id: toTaskId(id),
      // Participação de responsável com id próprio: o primeiro caractere muda, o resto segue o id da tarefa.
      responsibleParticipationId: toParticipationId(`7${id.slice(1)}`),
      organizationId: placement.organization ?? organizationId,
      projectId,
      createdBy: userId,
      title: placement.title ?? 'Tarefa de backlog',
    })
    .build()
  const backlogRank = placement.backlogRank ?? null
  return {
    ...task,
    backlogRank,
    onBoard: backlogRank === null,
    archivedAt: placement.archivedAt ?? null,
    estimatedHours: placement.estimatedHours ?? null,
  }
}

function aCriterion(id: string, text: string, done = false): AcceptanceCriterion {
  return { id: toAcceptanceCriterionId(id), text, done }
}

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

    it('listagens, buscas e contagens ocultam tarefas arquivadas, e findById continua trazendo a arquivada', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      const activeTask = aTask()
        .with({
          id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FBE'),
          responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FBF'),
          organizationId,
          createdBy: userId,
          title: 'Tarefa ativa',
        })
        .inProject(project)
        .build()
      const archivedTask = {
        ...aTask()
          .with({
            id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FBG'),
            responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FBH'),
            organizationId,
            createdBy: userId,
            title: 'Tarefa arquivada',
          })
          .inProject(project)
          .build(),
        archivedAt: '2026-01-06T00:00:00.000Z',
      }
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      await repositories.tasks.save(organizationId, activeTask)
      await repositories.tasks.save(organizationId, archivedTask)
      await repositories.taskOpens.recordOpen(organizationId, activeTask.id, userId, timestamp)
      await repositories.taskOpens.recordOpen(organizationId, archivedTask.id, userId, timestamp)

      await expect(repositories.tasks.listBoard(organizationId, {})).resolves.toEqual([activeTask])
      await expect(repositories.tasks.listBoard(organizationId, { projectId })).resolves.toEqual([
        activeTask,
      ])
      await expect(repositories.tasks.listBoard(organizationId, { userId })).resolves.toEqual([
        activeTask,
      ])
      await expect(repositories.tasks.listByProject(organizationId, projectId)).resolves.toEqual([
        activeTask,
      ])
      await expect(repositories.tasks.listRecent(organizationId, userId)).resolves.toEqual([
        activeTask,
      ])
      await expect(repositories.tasks.listFrequent(organizationId, userId)).resolves.toEqual([
        activeTask,
      ])
      await expect(repositories.tasks.search(organizationId, 'tarefa', userId)).resolves.toEqual([
        activeTask,
      ])
      // Contagens da prévia de módulos contam só itens ativos: a arquivada e a responsável dela ficam de fora.
      await expect(repositories.tasks.count(organizationId)).resolves.toBe(1)
      await expect(repositories.participations.count(organizationId)).resolves.toBe(1)
      // Leitura por identificador não filtra: a linha do tempo e o desfazer dependem dela.
      await expect(repositories.tasks.findById(organizationId, archivedTask.id)).resolves.toEqual(
        archivedTask,
      )
    })

    it('lista só as tarefas arquivadas da organização, das arquivadas mais recentes para as antigas', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject()
        .with({ id: projectId, organizationId, name: 'Projeto com arquivadas' })
        .build()
      const active = aTask()
        .with({
          id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FBP'),
          responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FBQ'),
          organizationId,
          createdBy: userId,
          title: 'Tarefa ativa',
        })
        .inProject(project)
        .build()
      const archivedEarlier = {
        ...aTask()
          .with({
            id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FBR'),
            responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FBS'),
            organizationId,
            createdBy: userId,
            title: 'Arquivada antiga',
          })
          .inProject(project)
          .build(),
        archivedAt: '2026-01-05T00:00:00.000Z',
      }
      const archivedLater = {
        ...aTask()
          .with({
            id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FBT'),
            responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FBV'),
            organizationId,
            createdBy: userId,
            title: 'Arquivada recente',
          })
          .inProject(project)
          .build(),
        archivedAt: '2026-01-07T00:00:00.000Z',
      }
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      await repositories.tasks.save(organizationId, active)
      await repositories.tasks.save(organizationId, archivedEarlier)
      await repositories.tasks.save(organizationId, archivedLater)

      await expect(repositories.tasks.listArchived(organizationId)).resolves.toEqual([
        archivedLater,
        archivedEarlier,
      ])
      // Outra organização não vê as arquivadas daqui, mesmo com o mesmo projeto no banco.
      await expect(repositories.tasks.listArchived(otherOrganizationId)).resolves.toEqual([])
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

    it('findActiveByNameKey ignora projeto arquivado, mesmo gravado antes do ativo', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const archived = {
        ...aProject()
          .with({
            id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB5'),
            organizationId,
            name: 'Projeto Alfa',
          })
          .build(),
        archivedAt: timestamp,
      }
      const active = aProject()
        .with({
          id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB6'),
          organizationId,
          name: 'Projeto Alfa',
        })
        .build()
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, archived)
      await repositories.projects.save(organizationId, active)

      await expect(
        repositories.projects.findActiveByNameKey(organizationId, active.nameKey),
      ).resolves.toEqual(active)
      await expect(
        repositories.projects.findActiveByNameKey(otherOrganizationId, active.nameKey),
      ).resolves.toBeNull()
    })

    it('findActiveByNameKey devolve null quando só existe projeto arquivado com o nome', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const archived = {
        ...aProject()
          .with({
            id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB5'),
            organizationId,
            name: 'Projeto Alfa',
          })
          .build(),
        archivedAt: timestamp,
      }
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, archived)

      await expect(
        repositories.projects.findActiveByNameKey(organizationId, archived.nameKey),
      ).resolves.toBeNull()
    })

    it('impede dois projetos ativos com o mesmo nome na organização, e aceita arquivado com o nome', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const first = aProject()
        .with({
          id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB5'),
          organizationId,
          name: 'Projeto Alfa',
        })
        .build()
      const sameNameActive = aProject()
        .with({
          id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB6'),
          organizationId,
          name: '  projeto ALFA ',
        })
        .build()
      const archivedSameName = {
        ...aProject()
          .with({
            id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB7'),
            organizationId,
            name: 'Projeto Alfa',
          })
          .build(),
        archivedAt: timestamp,
      }
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, first)

      await expect(
        repositories.projects.save(organizationId, sameNameActive),
      ).rejects.toMatchObject({ code: 'VALIDATION', message: 'Já existe um projeto com este nome' })
      await expect(
        repositories.projects.save(organizationId, archivedSameName),
      ).resolves.toBeUndefined()
      await expect(
        repositories.projects.findById(organizationId, sameNameActive.id),
      ).resolves.toBeNull()
    })

    it('impede desarquivar (gravar sem arquivo) quando o nome já é de outro projeto ativo', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const active = aProject()
        .with({
          id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB5'),
          organizationId,
          name: 'Projeto Alfa',
        })
        .build()
      const archived = {
        ...aProject()
          .with({
            id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB6'),
            organizationId,
            name: 'Projeto Alfa',
          })
          .build(),
        archivedAt: timestamp,
      }
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, active)
      await repositories.projects.save(organizationId, archived)

      await expect(
        repositories.projects.save(organizationId, { ...archived, archivedAt: null }),
      ).rejects.toMatchObject({ code: 'VALIDATION', message: 'Já existe um projeto com este nome' })
      await expect(repositories.projects.findById(organizationId, archived.id)).resolves.toEqual(
        archived,
      )
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

    it('escrita com identificador de outra organização não altera nem move o registro (M1.12)', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId, name: 'Ana' }).build()
      const project = aProject().with({ id: projectId, organizationId, name: 'Projeto A' }).build()
      const contributor = aContributor().with({ organizationId, name: 'Colaborador A' }).build()
      const task = aTask()
        .with({ id: taskId, organizationId, createdBy: userId, title: 'Tarefa A' })
        .inProject(project)
        .build()
      const participation = aParticipation(task)
        .with({ participant: { kind: 'contributor', contributorId: contributor.id } })
        .build()
      const meeting = aMeeting().with({ organizationId, title: 'Reunião A' }).build()

      // A organização B tem dono próprio (usuário e projeto), para a escrita passar pelas checagens de posse.
      const otherUser = aUser()
        .with({
          id: otherUserId,
          organizationId: otherOrganizationId,
          name: 'Bia',
          email: 'bia@example.com',
        })
        .build()
      const otherProject = aProject()
        .with({ id: otherProjectId, organizationId: otherOrganizationId, name: 'Projeto B' })
        .build()

      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      await repositories.contributors.save(organizationId, contributor)
      await repositories.tasks.save(organizationId, task)
      await repositories.participations.save(organizationId, participation)
      await repositories.meetings.save(organizationId, meeting)
      await repositories.users.save(otherOrganizationId, otherUser)
      await repositories.projects.save(otherOrganizationId, otherProject)

      // Tentativas de B gravar com os ids de A.
      const other = otherOrganizationId
      await repositories.users.save(other, { ...user, organizationId: other, name: 'Invasora' })
      await repositories.projects.save(other, {
        ...project,
        organizationId: other,
        name: 'Invadido',
        nameKey: 'invadido',
      })
      await repositories.contributors.save(other, {
        ...contributor,
        organizationId: other,
        name: 'Invasor',
      })
      await repositories.meetings.save(other, {
        ...meeting,
        organizationId: other,
        title: 'Invasão',
      })
      await repositories.tasks.save(other, {
        ...task,
        organizationId: other,
        projectId: otherProject.id,
        createdBy: otherUser.id,
        participations: [],
        title: 'Invasão',
      })
      await repositories.participations.save(other, { ...participation, role: 'support' })

      // A continua com os registros originais.
      await expect(repositories.users.findById(organizationId, userId)).resolves.toEqual(user)
      await expect(repositories.projects.findById(organizationId, projectId)).resolves.toEqual(
        project,
      )
      await expect(
        repositories.contributors.findById(organizationId, contributor.id),
      ).resolves.toEqual(contributor)
      await expect(repositories.meetings.findById(organizationId, meeting.id)).resolves.toEqual(
        meeting,
      )
      await expect(repositories.tasks.findById(organizationId, taskId)).resolves.toMatchObject({
        id: taskId,
        organizationId,
        title: 'Tarefa A',
        projectId,
      })
      await expect(
        repositories.participations.findById(organizationId, participation.id),
      ).resolves.toEqual(participation)

      // B não ganha cópia nem enxerga os registros de A.
      await expect(repositories.users.findById(other, userId)).resolves.toBeNull()
      await expect(repositories.projects.findById(other, projectId)).resolves.toBeNull()
      await expect(repositories.contributors.findById(other, contributor.id)).resolves.toBeNull()
      await expect(repositories.meetings.findById(other, meeting.id)).resolves.toBeNull()
      await expect(repositories.tasks.findById(other, taskId)).resolves.toBeNull()
      await expect(
        repositories.participations.findById(other, participation.id),
      ).resolves.toBeNull()
    })

    it('lista o backlog do time pela posição, sem arquivadas nem tarefas do quadro, e isola por organização (M3.9)', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      const second = aPlacedTask(ulid('K2'), { backlogRank: 2 })
      const first = aPlacedTask(ulid('K1'), { backlogRank: 1 })
      const onBoard = aPlacedTask(ulid('K3'))
      const archived = aPlacedTask(ulid('K4'), { backlogRank: 3, archivedAt: timestamp })
      for (const task of [second, first, onBoard, archived]) {
        await repositories.tasks.save(organizationId, task)
      }

      await expect(repositories.tasks.listBacklog(organizationId)).resolves.toEqual([first, second])
      await expect(repositories.tasks.listBacklog(otherOrganizationId)).resolves.toEqual([])
    })

    it('o upsert por id grava posição, quadro e estimativa, e não troca a organização da linha (M3.9)', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      const otherUser = aUser()
        .with({ id: otherUserId, organizationId: otherOrganizationId, email: 'bia@example.com' })
        .build()
      const otherProject = aProject()
        .with({ id: otherProjectId, organizationId: otherOrganizationId, name: 'Projeto B' })
        .build()
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      await repositories.users.save(otherOrganizationId, otherUser)
      await repositories.projects.save(otherOrganizationId, otherProject)
      const task = aPlacedTask(ulid('K5'), { estimatedHours: 1250 })
      await repositories.tasks.save(organizationId, task)
      await expect(repositories.tasks.findById(organizationId, task.id)).resolves.toEqual(task)

      // Estimativa zero é válida e não é o mesmo que sem estimativa.
      const sentToBacklog = { ...task, backlogRank: 1, onBoard: false, estimatedHours: 0 }
      await repositories.tasks.save(organizationId, sentToBacklog)
      await expect(repositories.tasks.findById(organizationId, task.id)).resolves.toEqual(
        sentToBacklog,
      )

      // Outra organização tenta gravar com o mesmo id: a linha de A não muda.
      const intruder = aTask()
        .with({
          id: task.id,
          organizationId: otherOrganizationId,
          projectId: otherProjectId,
          createdBy: otherUserId,
          responsibleParticipationId: toParticipationId(`7${task.id.slice(1)}`),
          title: 'Invasão',
        })
        .build()
      await repositories.tasks.save(otherOrganizationId, intruder)
      await expect(repositories.tasks.findById(organizationId, task.id)).resolves.toEqual(
        sentToBacklog,
      )
      await expect(repositories.tasks.findById(otherOrganizationId, task.id)).resolves.toBeNull()
    })

    it('grava as posições do backlog em lote; uma posição inválida recusa o lote inteiro (M3.9)', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      const first = aPlacedTask(ulid('K1'), { backlogRank: 1 })
      const second = aPlacedTask(ulid('K2'), { backlogRank: 2 })
      await repositories.tasks.save(organizationId, first)
      await repositories.tasks.save(organizationId, second)

      await repositories.tasks.saveBacklogRanks(organizationId, [
        { id: second.id, backlogRank: 1 },
        { id: first.id, backlogRank: 2 },
      ])
      await expect(repositories.tasks.listBacklog(organizationId)).resolves.toEqual([
        { ...second, backlogRank: 1 },
        { ...first, backlogRank: 2 },
      ])

      // Posição 0 é inválida: a primeira alteração do lote não pode ficar gravada.
      await expect(
        repositories.tasks.saveBacklogRanks(organizationId, [
          { id: first.id, backlogRank: 1 },
          { id: second.id, backlogRank: 0 },
        ]),
      ).rejects.toThrow()
      await expect(repositories.tasks.listBacklog(organizationId)).resolves.toEqual([
        { ...second, backlogRank: 1 },
        { ...first, backlogRank: 2 },
      ])
    })

    it('o lote de posições ignora tarefa de outra organização (M3.9)', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      const otherUser = aUser()
        .with({ id: otherUserId, organizationId: otherOrganizationId, email: 'bia@example.com' })
        .build()
      const otherProject = aProject()
        .with({ id: otherProjectId, organizationId: otherOrganizationId, name: 'Projeto B' })
        .build()
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      await repositories.users.save(otherOrganizationId, otherUser)
      await repositories.projects.save(otherOrganizationId, otherProject)
      const mine = aPlacedTask(ulid('K1'))
      const theirs = aTask()
        .with({
          id: toTaskId(ulid('K6')),
          organizationId: otherOrganizationId,
          createdBy: otherUserId,
          responsibleParticipationId: toParticipationId(`7${ulid('K6').slice(1)}`),
        })
        .inProject(otherProject)
        .build()
      await repositories.tasks.save(organizationId, mine)
      await repositories.tasks.save(otherOrganizationId, theirs)

      await repositories.tasks.saveBacklogRanks(organizationId, [
        { id: mine.id, backlogRank: 1 },
        { id: theirs.id, backlogRank: 1 },
      ])

      await expect(repositories.tasks.findById(otherOrganizationId, theirs.id)).resolves.toEqual(
        theirs,
      )
      await expect(repositories.tasks.listBacklog(otherOrganizationId)).resolves.toEqual([])
      await expect(repositories.tasks.listBacklog(organizationId)).resolves.toEqual([
        { ...mine, backlogRank: 1, onBoard: false },
      ])
    })

    it('grava os critérios na ordem da lista, troca a lista inteira e isola por tarefa e organização (M3.9)', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      const taskA = aPlacedTask(ulid('K1'))
      const taskB = aPlacedTask(ulid('K2'))
      await repositories.tasks.save(organizationId, taskA)
      await repositories.tasks.save(organizationId, taskB)
      const first = aCriterion(ulid('C1'), 'Tela abre')
      const second = aCriterion(ulid('C2'), 'Erro mostrado', true)
      const third = aCriterion(ulid('C3'), 'Texto em pt-BR')

      await repositories.taskCriteria.replaceForTask(organizationId, taskA.id, [
        first,
        second,
        third,
      ])
      await expect(repositories.taskCriteria.listByTask(organizationId, taskA.id)).resolves.toEqual(
        [first, second, third],
      )

      await repositories.taskCriteria.replaceForTask(organizationId, taskA.id, [third, first])
      await expect(repositories.taskCriteria.listByTask(organizationId, taskA.id)).resolves.toEqual(
        [third, first],
      )

      await repositories.taskCriteria.replaceForTask(organizationId, taskA.id, [])
      await expect(repositories.taskCriteria.listByTask(organizationId, taskA.id)).resolves.toEqual(
        [],
      )

      await repositories.taskCriteria.replaceForTask(organizationId, taskB.id, [second])
      await expect(repositories.taskCriteria.listByTask(organizationId, taskB.id)).resolves.toEqual(
        [second],
      )
      await expect(
        repositories.taskCriteria.listByTask(otherOrganizationId, taskB.id),
      ).resolves.toEqual([])
    })

    it('troca de critérios é atômica: id repetido ou já usado por outra tarefa mantém a lista anterior (M3.9)', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      const taskA = aPlacedTask(ulid('K1'))
      const taskB = aPlacedTask(ulid('K2'))
      await repositories.tasks.save(organizationId, taskA)
      await repositories.tasks.save(organizationId, taskB)
      const first = aCriterion(ulid('C1'), 'Primeiro')
      const second = aCriterion(ulid('C2'), 'Segundo')
      const third = aCriterion(ulid('C3'), 'Terceiro')
      await repositories.taskCriteria.replaceForTask(organizationId, taskA.id, [first, second])

      // Id de A reaproveitado em B: a troca de B não entra, e B continua sem critérios.
      await expect(
        repositories.taskCriteria.replaceForTask(organizationId, taskB.id, [third, first]),
      ).rejects.toThrow()
      await expect(repositories.taskCriteria.listByTask(organizationId, taskB.id)).resolves.toEqual(
        [],
      )

      // Id repetido na própria lista: A continua com a lista anterior.
      await expect(
        repositories.taskCriteria.replaceForTask(organizationId, taskA.id, [third, third]),
      ).rejects.toThrow()
      await expect(repositories.taskCriteria.listByTask(organizationId, taskA.id)).resolves.toEqual(
        [first, second],
      )
    })

    it('troca de critérios de tarefa de outra organização é ignorada (M3.9)', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      const task = aPlacedTask(ulid('K1'))
      await repositories.tasks.save(organizationId, task)

      await repositories.taskCriteria.replaceForTask(otherOrganizationId, task.id, [
        aCriterion(ulid('C4'), 'Invasão'),
      ])

      await expect(repositories.taskCriteria.listByTask(organizationId, task.id)).resolves.toEqual(
        [],
      )
      await expect(
        repositories.taskCriteria.listByTask(otherOrganizationId, task.id),
      ).resolves.toEqual([])
    })

    it('arquivar a tarefa não apaga os critérios (M3.9)', async () => {
      const repositories = makeAdapters()
      const user = aUser().with({ id: userId, organizationId }).build()
      const project = aProject().with({ id: projectId, organizationId }).build()
      await repositories.users.save(organizationId, user)
      await repositories.projects.save(organizationId, project)
      const task = aPlacedTask(ulid('K1'))
      await repositories.tasks.save(organizationId, task)
      const criterion = aCriterion(ulid('C1'), 'Continua existindo')
      await repositories.taskCriteria.replaceForTask(organizationId, task.id, [criterion])

      await repositories.tasks.save(organizationId, { ...task, archivedAt: timestamp })

      await expect(repositories.taskCriteria.listByTask(organizationId, task.id)).resolves.toEqual([
        criterion,
      ])
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
