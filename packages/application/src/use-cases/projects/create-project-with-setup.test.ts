import { describe, expect, it } from 'vitest'
import {
  createOrganization,
  createUser,
  MODULE_IDS,
  toOrganizationId,
  toProjectId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { Actor, WizardAnswers } from '@agilebox/core'
import type { CreateProjectWithSetupInput } from '@agilebox/contract'
import { createTenantContext } from '../../tenant-context'
import type { TenantContext } from '../../tenant-context'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession, ProjectSetupRepository, UnitOfWork } from '../../ports'
import { aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'

const NOW = '2026-11-16T12:00:00.000Z'
/** Id que nenhum projeto criado nos testes recebe (o gerador começa do 0). */
const NO_PROJECT = '00000000000000000000000099'

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

const AGIL_ANSWERS: WizardAnswers = {
  workType: 'finite',
  fixedDate: 'no',
  scope: 'defined',
  outsiderFollows: 'yes',
  controlsHoursAndCost: 'yes',
  experience: 'sometimes',
}

interface Options {
  /** Troca o UnitOfWork (ex.: para simular falha numa gravação). */
  readonly unitOfWork?: InMemoryUnitOfWork
  readonly setupRepository?: ProjectSetupRepository
}

async function setup(options: Options = {}) {
  const unitOfWork = options.unitOfWork ?? new InMemoryUnitOfWork()
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
  const deps = {
    acceptance: repositories.acceptance,
    actorSession,
    boardSettings: repositories.boardSettings,
    changeNotifier: notifier,
    checklist: repositories.checklist,
    clock: new FixedClock(NOW),
    comments: repositories.comments,
    contributors: repositories.contributors,
    dailyEntries: repositories.dailyEntries,
    definitionOfDone: repositories.definitionOfDone,
    idGenerator: new SequentialIdGenerator(),
    impediments: repositories.impediments,
    meetings: repositories.meetings,
    organizations: repositories.organizations,
    participations: repositories.participations,
    projectModules: repositories.projectModules,
    projectSetup: options.setupRepository ?? repositories.projectSetup,
    guideProgress: repositories.guideProgress,
    projects: repositories.projects,
    retroActions: repositories.retroActions,
    sprints: repositories.sprints,
    sprintTasks: repositories.sprintTasks,
    deliverables: repositories.deliverables,
    taskDependencies: repositories.taskDependencies,
    milestones: repositories.milestones,
    risks: repositories.risks,
    taskOpens: repositories.taskOpens,
    tasks: repositories.tasks,
    teamTools: repositories.teamTools,
    timeline: repositories.timeline,
    unitOfWork: unitOfWork as UnitOfWork,
    users: repositories.users,
  }
  const useCases = createUseCases(deps)
  return { useCases, repositories, notifier, unitOfWork }
}

describe('projects.createWithSetup', () => {
  it('pular o assistente cria o projeto Simples, sem módulos gravados', async () => {
    const { useCases, repositories } = await setup()
    const dto = await useCases.projects.createWithSetup.execute(contextManagerA, {
      name: 'Projeto Simples',
    })

    expect(dto.name).toBe('Projeto Simples')
    expect(dto.modules).toEqual(['core'])
    expect(dto.startedFromPreset).toBe('simples')
    expect(await repositories.projectModules.list(orgA, toProjectId(dto.id))).toEqual([])
    expect(await repositories.projectSetup.get(orgA, toProjectId(dto.id))).toEqual({
      projectId: dto.id,
      answers: null,
      recommendedPreset: 'simples',
      startedFromPreset: 'simples',
      guideLevel: 'never',
    })
  })

  it('wizard completo Ágil grava os módulos do preset e os das respostas, e a configuração', async () => {
    const { useCases, repositories } = await setup()
    const dto = await useCases.projects.createWithSetup.execute(contextManagerA, {
      name: 'Projeto Ágil',
      answers: AGIL_ANSWERS,
    })
    const projectId = toProjectId(dto.id)

    const rows = await repositories.projectModules.list(orgA, projectId)
    const active = rows.filter((row) => row.state === 'active').map((row) => row.moduleId)
    // Preset Ágil (com a experiência "sometimes" acrescentando os extras) e os módulos das respostas.
    for (const id of ['backlog', 'sprints', 'estimates.hours', 'cost', 'milestones'] as const)
      expect(active).toContain(id)
    expect(active).not.toContain('core')
    expect(rows.every((row) => row.changedBy === managerAId && row.changedAt === NOW)).toBe(true)
    expect(dto.modules).toEqual(MODULE_IDS.filter((id) => id === 'core' || active.includes(id)))

    expect(await repositories.projectSetup.get(orgA, projectId)).toEqual({
      projectId,
      answers: AGIL_ANSWERS,
      recommendedPreset: 'agil',
      startedFromPreset: 'agil',
      guideLevel: 'sometimes',
    })
    expect(dto.startedFromPreset).toBe('agil')
  })

  it('o preset de partida escolhido vale sobre a recomendação, e a experiência vem das respostas', async () => {
    const { useCases, repositories } = await setup()
    const dto = await useCases.projects.createWithSetup.execute(contextManagerA, {
      name: 'Projeto Kanban',
      answers: { workType: 'continuous', experience: 'always' },
      startedFromPreset: 'kanban',
    })
    const projectId = toProjectId(dto.id)

    const saved = await repositories.projectSetup.get(orgA, projectId)
    expect(saved?.recommendedPreset).toBe('kanban')
    expect(saved?.startedFromPreset).toBe('kanban')
    expect(saved?.guideLevel).toBe('always')
    const active = (await repositories.projectModules.list(orgA, projectId))
      .filter((row) => row.state === 'active')
      .map((row) => row.moduleId)
    expect(active).toEqual(
      expect.arrayContaining(['wip', 'definitionOfDone', 'checkins', 'flowMetrics']),
    )
  })

  it('módulos informados com dependência faltando puxam o que falta', async () => {
    const { useCases, repositories } = await setup()
    const dto = await useCases.projects.createWithSetup.execute(contextManagerA, {
      name: 'Projeto com sprints',
      modules: ['sprints'],
    })
    const active = (await repositories.projectModules.list(orgA, toProjectId(dto.id)))
      .filter((row) => row.state === 'active')
      .map((row) => row.moduleId)

    expect(active).toEqual(expect.arrayContaining(['sprints', 'backlog']))
    expect(dto.modules).toEqual(expect.arrayContaining(['sprints', 'backlog']))
    expect(dto.startedFromPreset).toBe('simples')
  })

  it('módulos em conflito são recusados com ValidationError e nada é criado', async () => {
    const { useCases, repositories } = await setup()
    const request: CreateProjectWithSetupInput = {
      name: 'Projeto em conflito',
      modules: ['estimates.hours', 'estimates.points'],
    }

    await expect(
      useCases.projects.createWithSetup.execute(contextManagerA, request),
    ).rejects.toThrow(ValidationError)
    expect(await repositories.projects.findByNameKey(orgA, 'projeto em conflito')).toBeNull()
  })

  it('módulo fora do catálogo é recusado com mensagem clara', async () => {
    const { useCases } = await setup()
    await expect(
      useCases.projects.createWithSetup.execute(contextManagerA, {
        name: 'Projeto X',
        modules: ['inexistente'],
      }),
    ).rejects.toThrow('Ferramenta desconhecida: inexistente')
  })

  it('nome vazio é recusado com ValidationError', async () => {
    const { useCases } = await setup()
    await expect(
      useCases.projects.createWithSetup.execute(contextManagerA, { name: '   ' }),
    ).rejects.toThrow(ValidationError)
  })

  it('colaborador e gestor criam, como em createProject', async () => {
    const { useCases, repositories } = await setup()
    const byCollaborator = await useCases.projects.createWithSetup.execute(contextCollaboratorA, {
      name: 'Projeto da Ana',
    })
    const byManager = await useCases.projects.createWithSetup.execute(contextManagerA, {
      name: 'Projeto da gestora',
    })

    expect(
      await repositories.projects.findById(orgA, toProjectId(byCollaborator.id)),
    ).not.toBeNull()
    expect(await repositories.projects.findById(orgA, toProjectId(byManager.id))).not.toBeNull()
    const members = await repositories.projects.listMembers(orgA, toProjectId(byCollaborator.id))
    expect(members.map((member) => member.userId)).toEqual([collaboratorId])
  })

  it('o membro criador entra no projeto, como em createProject', async () => {
    const { useCases, repositories } = await setup()
    const dto = await useCases.projects.createWithSetup.execute(contextManagerB, {
      name: 'Projeto B',
      answers: AGIL_ANSWERS,
    })

    expect(await repositories.projects.listMembers(orgB, toProjectId(dto.id))).toEqual([
      expect.objectContaining({ userId: managerBId }),
    ])
    expect(await repositories.projectSetup.get(orgB, toProjectId(dto.id))).not.toBeNull()
    expect(await repositories.projectSetup.get(orgA, toProjectId(dto.id))).toBeNull()
  })

  it('é atômico: se gravar os módulos falha, o projeto e a configuração não ficam criados', async () => {
    // A gravação de módulos lança depois de o projeto já ter sido gravado na mesma operação.
    const unitOfWork = new InMemoryUnitOfWork()
    const failing = unitOfWork.repositories as { projectModules: unknown }
    failing.projectModules = {
      ...unitOfWork.repositories.projectModules,
      save: () => Promise.reject(new Error('falha simulada na gravação de módulos')),
    }
    const { useCases, repositories } = await setup({ unitOfWork })

    await expect(
      useCases.projects.createWithSetup.execute(contextManagerA, {
        name: 'Projeto atômico',
        answers: AGIL_ANSWERS,
      }),
    ).rejects.toThrow('falha simulada na gravação de módulos')
    expect(await repositories.projects.findByNameKey(orgA, 'projeto atômico')).toBeNull()
    expect(await repositories.projects.list(orgA)).toEqual([])
    expect(await repositories.projectSetup.get(orgA, toProjectId(NO_PROJECT))).toBeNull()
  })

  it('é atômico também quando falha a gravação da configuração', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const failing = unitOfWork.repositories as { projectSetup: unknown }
    failing.projectSetup = {
      get: () => Promise.resolve(null),
      save: () => Promise.reject(new Error('falha simulada na configuração')),
    }
    const { useCases, repositories } = await setup({ unitOfWork })

    await expect(
      useCases.projects.createWithSetup.execute(contextManagerA, {
        name: 'Projeto sem configuração',
        modules: ['backlog'],
      }),
    ).rejects.toThrow('falha simulada na configuração')
    expect(await repositories.projects.findByNameKey(orgA, 'projeto sem configuração')).toBeNull()
    expect(await repositories.projectModules.list(orgA, toProjectId(NO_PROJECT))).toEqual([])
  })

  it('nome repetido seleciona o projeto existente e não aplica o assistente', async () => {
    const { useCases, repositories } = await setup()
    const first = await useCases.projects.createWithSetup.execute(contextManagerA, {
      name: 'Projeto repetido',
    })
    const second = await useCases.projects.createWithSetup.execute(contextManagerA, {
      name: 'projeto repetido',
      answers: AGIL_ANSWERS,
    })

    expect(second.id).toBe(first.id)
    expect(second.modules).toEqual(['core'])
    expect(await repositories.projectSetup.get(orgA, toProjectId(first.id))).toEqual(
      expect.objectContaining({ answers: null, startedFromPreset: 'simples' }),
    )
  })

  it('outro tenant não enxerga o projeto, os módulos nem a configuração', async () => {
    const { useCases, repositories } = await setup()
    const dto = await useCases.projects.createWithSetup.execute(contextManagerA, {
      name: 'Projeto privado',
      answers: AGIL_ANSWERS,
    })
    const projectId = toProjectId(dto.id)

    expect(await repositories.projects.findById(orgB, projectId)).toBeNull()
    expect(await repositories.projectModules.list(orgB, projectId)).toEqual([])
    expect(await repositories.projectSetup.get(orgB, projectId)).toBeNull()
    const visibleToB = await useCases.projects.listProjects.execute(contextManagerB, {})
    expect(visibleToB.map((project) => project.id)).not.toContain(dto.id)
  })

  it('publica a mudança de projeto quando cria', async () => {
    const { useCases, notifier } = await setup()
    const dto = await useCases.projects.createWithSetup.execute(contextManagerA, {
      name: 'Notificado',
    })

    expect(notifier.changes).toContainEqual({
      organizationId: orgA,
      change: { kind: 'project', ids: [dto.id] },
    })
  })
})
