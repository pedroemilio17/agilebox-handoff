import { describe, expect, it } from 'vitest'
import {
  createOrganization,
  createUser,
  NotFoundError,
  PermissionDeniedError,
  toOrganizationId,
  toProjectId,
  toUserId,
} from '@agilebox/core'
import type { Actor, ProjectId } from '@agilebox/core'
import { createTenantContext } from '../../tenant-context'
import type { TenantContext } from '../../tenant-context'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'
import { aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { recordGuideEvent } from './record-guide-event'

const NOW = '2026-11-16T12:00:00.000Z'
const LATER = '2026-11-16T13:00:00.000Z'

const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('00000000000000000000000002')
const collaboratorId = toUserId('00000000000000000000000011')
const managerAId = toUserId('00000000000000000000000012')
const managerBId = toUserId('00000000000000000000000021')
const collaboratorA: Actor = { userId: collaboratorId, organizationId: orgA, role: 'collaborator' }
const managerA: Actor = { userId: managerAId, organizationId: orgA, role: 'manager' }
const managerB: Actor = { userId: managerBId, organizationId: orgB, role: 'manager' }
const contextManagerA: TenantContext = createTenantContext(managerA)
const contextCollaboratorA: TenantContext = createTenantContext(collaboratorA)
const contextManagerB: TenantContext = createTenantContext(managerB)

/** Trilha do preset Ágil, na ordem do guia (módulos na ordem do catálogo, passos do manifesto). */
const AGIL_TRAIL = [
  'backlog.list',
  'backlog.rank',
  'sprints.create',
  'sprints.add',
  'daily.answer',
  'estimate.first',
  'ceremonies.planning',
]
const AGIL_MODULES = ['backlog', 'estimates.hours', 'sprints', 'reviewRetro', 'checkins'] as const

async function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const repositories = unitOfWork.repositories
  for (const [id, name, taskPrefix] of [
    [orgA, 'Time A', 'AAA'],
    [orgB, 'Time B', 'BBB'],
  ] as const)
    await repositories.organizations.save(
      createOrganization({ id, name, taskPrefix, createdAt: '2026-01-01T00:00:00.000Z' }),
    )
  const people = [
    [orgA, collaboratorId, 'Ana', 'collaborator', 'ana@example.com'],
    [orgA, managerAId, 'Gestora A', 'manager', 'gestora-a@example.com'],
    [orgB, managerBId, 'Gestor B', 'manager', 'gestor-b@example.com'],
  ] as const
  for (const [organizationId, id, name, role, email] of people)
    await repositories.users.save(
      organizationId,
      createUser({ ...aUser().build(), id, organizationId, name, role, email }),
    )
  const actorSession: ActorSession = { get: () => managerA, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    acceptance: repositories.acceptance,
    boardSettings: repositories.boardSettings,
    changeNotifier: notifier,
    checklist: repositories.checklist,
    clock: new FixedClock(NOW),
    comments: repositories.comments,
    contributors: repositories.contributors,
    dailyEntries: repositories.dailyEntries,
    definitionOfDone: repositories.definitionOfDone,
    guideProgress: repositories.guideProgress,
    idGenerator: new SequentialIdGenerator(),
    impediments: repositories.impediments,
    meetings: repositories.meetings,
    organizations: repositories.organizations,
    participations: repositories.participations,
    projectModules: repositories.projectModules,
    projectSetup: repositories.projectSetup,
    projects: repositories.projects,
    retroActions: repositories.retroActions,
    sprints: repositories.sprints,
    sprintTasks: repositories.sprintTasks,
    taskOpens: repositories.taskOpens,
    tasks: repositories.tasks,
    teamTools: repositories.teamTools,
    timeline: repositories.timeline,
    unitOfWork,
    users: repositories.users,
  })
  return { useCases, unitOfWork }
}

type UseCases = Awaited<ReturnType<typeof setup>>['useCases']

/** Projeto da organização A, com a colaboradora como participante. */
async function projectWithCollaborator(useCases: UseCases): Promise<ProjectId> {
  const project = await useCases.projects.createProject.execute(contextManagerA, {
    name: 'Projeto',
  })
  await useCases.projects.addMember.execute(contextManagerA, {
    projectId: project.id,
    userId: collaboratorId,
  })
  return toProjectId(project.id)
}

/** Liga as ferramentas do preset Ágil no projeto (o gestor). */
async function enableAgil(useCases: UseCases, projectId: ProjectId) {
  return useCases.projectModules.change.execute(contextManagerA, {
    projectId,
    enable: [...AGIL_MODULES],
  })
}

describe('guia: trilha, progresso e dispensa', () => {
  it('trilha Ágil completa aparece na ordem do guia, com nada concluído no início', async () => {
    const { useCases } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)

    const view = await useCases.guide.get.execute(contextManagerA, { projectId })

    expect(view.trail.map((step) => step.key)).toEqual(AGIL_TRAIL)
    expect(view.total).toBe(AGIL_TRAIL.length)
    expect(view.done).toBe(0)
    expect(view.currentKey).toBe('backlog.list')
    expect(view.trail[0]).toMatchObject({
      key: 'backlog.list',
      moduleId: 'backlog',
      moduleName: 'Backlog',
      done: false,
      next: 'Ordene pela importância',
    })
    expect(view.trail.at(-1)?.next).toBeNull()
  })

  it('passo concluído pelo evento aparece como feito e o atual avança', async () => {
    const { useCases, unitOfWork } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)

    await recordGuideEvent(unitOfWork.repositories, managerA, projectId, 'task.created', NOW)
    const view = await useCases.guide.get.execute(contextManagerA, { projectId })

    expect(view.trail.find((step) => step.key === 'backlog.list')?.done).toBe(true)
    expect(view.done).toBe(1)
    expect(view.currentKey).toBe('backlog.rank')
  })

  it('o progresso é por pessoa: a colaboradora continua em zero', async () => {
    const { useCases, unitOfWork } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)

    await recordGuideEvent(unitOfWork.repositories, managerA, projectId, 'task.created', NOW)
    const manager = await useCases.guide.get.execute(contextManagerA, { projectId })
    const collaborator = await useCases.guide.get.execute(contextCollaboratorA, { projectId })

    expect(manager.done).toBe(1)
    expect(collaborator.done).toBe(0)
    expect(collaborator.currentKey).toBe('backlog.list')
  })

  it('dispensa do cartão persiste e só vale para quem dispensou', async () => {
    const { useCases } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)

    expect((await useCases.guide.get.execute(contextManagerA, { projectId })).cardDismissed).toBe(
      false,
    )
    await useCases.guide.dismissCard.execute(contextManagerA, { projectId })

    expect((await useCases.guide.get.execute(contextManagerA, { projectId })).cardDismissed).toBe(
      true,
    )
    expect(
      (await useCases.guide.get.execute(contextCollaboratorA, { projectId })).cardDismissed,
    ).toBe(false)
  })

  it('projeto Simples (sem módulos) tem trilha vazia e nenhum passo atual', async () => {
    const { useCases } = await setup()
    const project = await useCases.projects.createProject.execute(contextManagerA, {
      name: 'Simples',
    })

    const view = await useCases.guide.get.execute(contextManagerA, { projectId: project.id })

    expect(view.trail).toEqual([])
    expect(view.total).toBe(0)
    expect(view.done).toBe(0)
    expect(view.currentKey).toBeNull()
  })

  it('experiência vem do projeto; sem configuração, o padrão é "nunca" (intensidade cheia)', async () => {
    const { useCases, unitOfWork } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)

    const padrao = await useCases.guide.get.execute(contextManagerA, { projectId })
    expect(padrao.experience).toBe('never')
    expect(padrao.intensity).toEqual({
      firstStepsCard: 'open',
      emptyState: 'full',
      firstTimeHints: true,
      explainJargon: true,
    })

    await unitOfWork.repositories.projectSetup.save(orgA, {
      projectId,
      answers: null,
      recommendedPreset: null,
      startedFromPreset: null,
      guideLevel: 'always',
    })
    const sempre = await useCases.guide.get.execute(contextManagerA, { projectId })
    expect(sempre.experience).toBe('always')
    expect(sempre.intensity.firstStepsCard).toBe('hidden')
  })
})

describe('recordGuideEvent (serviço interno)', () => {
  it('conclui só o passo do evento e é idempotente: a primeira conclusão fica', async () => {
    const { useCases, unitOfWork } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)

    await recordGuideEvent(unitOfWork.repositories, managerA, projectId, 'task.created', NOW)
    await recordGuideEvent(unitOfWork.repositories, managerA, projectId, 'task.created', LATER)

    const rows = await unitOfWork.repositories.guideProgress.listForUser(
      orgA,
      projectId,
      managerAId,
    )
    expect(rows).toEqual([{ stepKey: 'backlog.list', doneAt: NOW, dismissed: false }])
  })

  it('evento sem passo na trilha não grava nada', async () => {
    const { useCases, unitOfWork } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)

    await recordGuideEvent(unitOfWork.repositories, managerA, projectId, 'deliverable.created', NOW)

    expect(
      await unitOfWork.repositories.guideProgress.listForUser(orgA, projectId, managerAId),
    ).toEqual([])
  })

  it('nunca lança: projeto inexistente, de outra organização ou sem módulos não tem efeito', async () => {
    const { useCases, unitOfWork } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)
    const simples = await useCases.projects.createProject.execute(contextManagerA, {
      name: 'Simples',
    })
    const inexistente = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FZZ')
    const repositories = unitOfWork.repositories

    await expect(
      recordGuideEvent(repositories, managerA, inexistente, 'task.created', NOW),
    ).resolves.toBeUndefined()
    await expect(
      recordGuideEvent(repositories, managerB, projectId, 'task.created', NOW),
    ).resolves.toBeUndefined()
    await expect(
      recordGuideEvent(repositories, managerA, toProjectId(simples.id), 'task.created', NOW),
    ).resolves.toBeUndefined()

    expect(await repositories.guideProgress.listForUser(orgA, projectId, managerAId)).toEqual([])
    expect(
      await repositories.guideProgress.listForUser(orgA, toProjectId(simples.id), managerAId),
    ).toEqual([])
  })
})

describe('acesso e isolamento', () => {
  it('colaborador que não participa do projeto não lê o guia nem dispensa o cartão', async () => {
    const { useCases } = await setup()
    const project = await useCases.projects.createProject.execute(contextManagerA, {
      name: 'Sem Ana',
    })
    await enableAgil(useCases, toProjectId(project.id))

    await expect(
      useCases.guide.get.execute(contextCollaboratorA, { projectId: project.id }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(
      useCases.guide.dismissCard.execute(contextCollaboratorA, { projectId: project.id }),
    ).rejects.toThrow(PermissionDeniedError)
  })

  it('outro tenant não enxerga o guia de um projeto de outra organização', async () => {
    const { useCases } = await setup()
    const projectId = await projectWithCollaborator(useCases)

    await expect(useCases.guide.get.execute(contextManagerB, { projectId })).rejects.toThrow(
      NotFoundError,
    )
    await expect(
      useCases.guide.dismissCard.execute(contextManagerB, { projectId }),
    ).rejects.toThrow(NotFoundError)
  })

  it('módulo desligado depois não quebra: passos concluídos dele saem do total e do progresso', async () => {
    const { useCases, unitOfWork } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)
    await recordGuideEvent(unitOfWork.repositories, managerA, projectId, 'task.created', NOW)
    await recordGuideEvent(unitOfWork.repositories, managerA, projectId, 'daily.answered', NOW)

    const antes = await useCases.guide.get.execute(contextManagerA, { projectId })
    expect(antes.done).toBe(2)

    await useCases.projectModules.change.execute(contextManagerA, {
      projectId,
      disable: ['backlog'],
    })
    const depois = await useCases.guide.get.execute(contextManagerA, { projectId })

    expect(depois.trail.map((step) => step.key)).not.toContain('backlog.list')
    expect(depois.total).toBe(depois.trail.length)
    // O passo do check-in segue ativo e continua contando; o do backlog saiu da trilha.
    expect(depois.done).toBe(1)
    expect(depois.trail.find((step) => step.key === 'daily.answer')?.done).toBe(true)
  })
})

/** Passos concluídos da pessoa, na trilha do projeto (lê pelo caso de uso, como a tela). */
async function doneKeysOf(useCases: UseCases, context: TenantContext, projectId: ProjectId) {
  const view = await useCases.guide.get.execute(context, { projectId })
  return view.trail.filter((step) => step.done).map((step) => step.key)
}

describe('eventos de alimentação nos casos de uso (ADR-10)', () => {
  it('criar tarefa conclui backlog.list para quem criou, e não para a outra pessoa', async () => {
    const { useCases } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)

    await useCases.tasks.create.execute(contextCollaboratorA, { projectId, title: 'Tarefa' })

    expect(await doneKeysOf(useCases, contextCollaboratorA, projectId)).toEqual(['backlog.list'])
    expect(await doneKeysOf(useCases, contextManagerA, projectId)).toEqual([])
  })

  it('adicionar ao backlog conclui backlog.list (mesma criação de tasks.create)', async () => {
    const { useCases } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)

    await useCases.backlog.add.execute(contextCollaboratorA, { projectId, title: 'Item' })

    expect(await doneKeysOf(useCases, contextCollaboratorA, projectId)).toEqual(['backlog.list'])
  })

  it('reordenar o backlog conclui backlog.rank para quem reordenou', async () => {
    const { useCases } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)
    await useCases.backlog.add.execute(contextCollaboratorA, { projectId, title: 'Primeiro' })
    const segundo = await useCases.backlog.add.execute(contextCollaboratorA, {
      projectId,
      title: 'Segundo',
    })

    await useCases.backlog.reorder.execute(contextCollaboratorA, {
      taskId: segundo.id,
      position: 'top',
    })

    expect(await doneKeysOf(useCases, contextCollaboratorA, projectId)).toEqual([
      'backlog.list',
      'backlog.rank',
    ])
    expect(await doneKeysOf(useCases, contextManagerA, projectId)).toEqual([])
  })

  it('reordenar sem mudar a posição não conclui backlog.rank', async () => {
    const { useCases } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)
    const unico = await useCases.backlog.add.execute(contextCollaboratorA, {
      projectId,
      title: 'Único',
    })

    await useCases.backlog.reorder.execute(contextCollaboratorA, {
      taskId: unico.id,
      position: 'top',
    })

    expect(await doneKeysOf(useCases, contextCollaboratorA, projectId)).toEqual(['backlog.list'])
  })

  it('definir estimativa conclui estimate.first; limpar a estimativa não conclui', async () => {
    const { useCases } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)
    const tarefa = await useCases.tasks.create.execute(contextCollaboratorA, {
      projectId,
      title: 'Estimar',
    })

    await useCases.tasks.setEstimate.execute(contextCollaboratorA, {
      taskId: tarefa.id,
      estimatedHours: null,
    })
    expect(await doneKeysOf(useCases, contextCollaboratorA, projectId)).toEqual(['backlog.list'])

    await useCases.tasks.setEstimate.execute(contextCollaboratorA, {
      taskId: tarefa.id,
      estimatedHours: 3,
    })
    expect(await doneKeysOf(useCases, contextCollaboratorA, projectId)).toEqual([
      'backlog.list',
      'estimate.first',
    ])
    expect(await doneKeysOf(useCases, contextManagerA, projectId)).toEqual([])
  })

  it('criar sprint conclui sprints.create e adicionar tarefa conclui sprints.add, para a gestora', async () => {
    const { useCases } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)
    const tarefa = await useCases.tasks.create.execute(contextCollaboratorA, {
      projectId,
      title: 'Para a sprint',
    })
    const sprint = await useCases.sprints.create.execute(contextManagerA, {
      projectId,
      plannedStart: '2026-11-16',
      plannedEnd: '2026-11-27',
    })

    expect(await doneKeysOf(useCases, contextManagerA, projectId)).toEqual(['sprints.create'])
    expect(await doneKeysOf(useCases, contextCollaboratorA, projectId)).toEqual(['backlog.list'])

    await useCases.sprints.addTask.execute(contextManagerA, {
      sprintId: sprint.sprint.id,
      taskId: tarefa.id,
    })

    expect(await doneKeysOf(useCases, contextManagerA, projectId)).toEqual([
      'sprints.create',
      'sprints.add',
    ])
    expect(await doneKeysOf(useCases, contextCollaboratorA, projectId)).toEqual(['backlog.list'])
  })

  it('projeto Simples: criar tarefa não grava progresso e não falha', async () => {
    const { useCases, unitOfWork } = await setup()
    const project = await useCases.projects.createProject.execute(contextManagerA, {
      name: 'Simples',
    })
    const projectId = toProjectId(project.id)

    const tarefa = await useCases.tasks.create.execute(contextManagerA, {
      projectId,
      title: 'Sem guia',
    })

    expect(tarefa.title).toBe('Sem guia')
    expect(
      await unitOfWork.repositories.guideProgress.listForUser(orgA, projectId, managerAId),
    ).toEqual([])
  })

  it('repetir a ação não duplica o passo', async () => {
    const { useCases, unitOfWork } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)

    await useCases.tasks.create.execute(contextCollaboratorA, { projectId, title: 'Uma' })
    await useCases.tasks.create.execute(contextCollaboratorA, { projectId, title: 'Duas' })

    const rows = await unitOfWork.repositories.guideProgress.listForUser(
      orgA,
      projectId,
      collaboratorId,
    )
    expect(rows.filter((row) => row.stepKey === 'backlog.list')).toHaveLength(1)
  })

  it('falha do caso de uso continua igual e não grava progresso', async () => {
    const { useCases, unitOfWork } = await setup()
    const projectId = await projectWithCollaborator(useCases)
    await enableAgil(useCases, projectId)

    await expect(
      useCases.tasks.setEstimate.execute(contextCollaboratorA, {
        taskId: '00000000000000000000000099',
        estimatedHours: 2,
      }),
    ).rejects.toThrow(NotFoundError)
    expect(
      await unitOfWork.repositories.guideProgress.listForUser(orgA, projectId, collaboratorId),
    ).toEqual([])
  })
})
