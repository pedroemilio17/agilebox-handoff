import { describe, expect, it } from 'vitest'
import {
  createOrganization,
  createUser,
  DEFAULT_TEAM_MODULE_IDS,
  toOrganizationId,
  toProjectId,
  toUserId,
  ValidationError,
  PermissionDeniedError,
} from '@agilebox/core'
import type { Actor, ModuleId } from '@agilebox/core'
import type { TeamToolsChangeInput } from '@agilebox/contract'
import { createTenantContext } from '../../tenant-context'
import type { TenantContext } from '../../tenant-context'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'
import { aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { setProjectModules } from '../../testing/task-harness'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'

const NOW = '2026-11-16T12:00:00.000Z'
const TODAY = '2026-11-16'
const MEETING_DATE = '2026-11-20'

const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('00000000000000000000000002')
const collaboratorId = toUserId('00000000000000000000000011')
const managerAId = toUserId('00000000000000000000000012')
const managerBId = toUserId('00000000000000000000000021')
const collaboratorA: Actor = { userId: collaboratorId, organizationId: orgA, role: 'collaborator' }
const managerA: Actor = { userId: managerAId, organizationId: orgA, role: 'manager' }
const managerB: Actor = { userId: managerBId, organizationId: orgB, role: 'manager' }
const contextA: TenantContext = createTenantContext(managerA)
const contextB: TenantContext = createTenantContext(managerB)
const contextCollaborator: TenantContext = createTenantContext(collaboratorA)

const REFUSED_DISABLED = {
  name: 'PermissionDeniedError',
  code: 'FORBIDDEN',
  message: 'Esta ferramenta está desativada para a equipe.',
}
const REFUSED_WINDING_DOWN = {
  name: 'ConflictError',
  code: 'CONFLICT',
  message: 'Esta ferramenta está sendo encerrada: não aceita itens novos.',
}
const ONLY_MANAGER = { name: 'PermissionDeniedError', code: 'FORBIDDEN' }

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
  const actorSession: ActorSession = { get: () => collaboratorA, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: notifier,
    clock: new FixedClock(NOW),
    boardSettings: repositories.boardSettings,
    checklist: repositories.checklist,
    acceptance: repositories.acceptance,
    comments: repositories.comments,
    contributors: repositories.contributors,
    dailyEntries: repositories.dailyEntries,
    teamTools: repositories.teamTools,
    projectModules: repositories.projectModules,
    projectSetup: repositories.projectSetup,
    guideProgress: repositories.guideProgress,
    sprints: repositories.sprints,
    sprintTasks: repositories.sprintTasks,
    deliverables: repositories.deliverables,
    taskDependencies: repositories.taskDependencies,
    milestones: repositories.milestones,
    impediments: repositories.impediments,
    definitionOfDone: repositories.definitionOfDone,
    idGenerator: new SequentialIdGenerator(),
    meetings: repositories.meetings,
    organizations: repositories.organizations,
    participations: repositories.participations,
    projects: repositories.projects,
    retroActions: repositories.retroActions,
    taskOpens: repositories.taskOpens,
    tasks: repositories.tasks,
    timeline: repositories.timeline,
    unitOfWork,
    users: repositories.users,
  })
  return { useCases, unitOfWork }
}

type UseCases = Awaited<ReturnType<typeof setup>>['useCases']

/** Estado efetivo de cada ferramenta na visão do gestor A. */
async function stateOf(useCases: UseCases, context: TenantContext = contextA) {
  const view = await useCases.teamTools.get.execute(context)
  return new Map(view.modules.map((module) => [module.id, module.state]))
}

/** Grava estados de ferramentas pelo caso de uso do gestor (o caminho de produção). */
async function change(useCases: UseCases, input: TeamToolsChangeInput) {
  return useCases.teamTools.applyChange.execute(contextA, input)
}

/** Muda as ferramentas de um projeto (ADR-10: é o que o guard lê), pelo caso de uso do projeto. */
async function changeProject(
  useCases: UseCases,
  projectId: string,
  input: { enable?: ModuleId[]; disable?: ModuleId[] },
) {
  return useCases.projectModules.change.execute(contextA, { projectId, ...input })
}

/** Ferramentas desligadas de vez (`disabled`) para os testes partirem de um estado conhecido. */
async function disableForGood(useCases: UseCases, moduleIds: ModuleId[]) {
  await change(useCases, { disable: moduleIds, finalize: moduleIds })
}

/** Dados existentes para os testes de contagem e de reativação. */
async function fixtures(useCases: UseCases) {
  const project = await useCases.projects.createProject.execute(contextA, { name: 'Projeto' })
  // O projeto começa só com o núcleo (ADR-10): liga as ferramentas que a equipe trazia por padrão.
  await changeProject(useCases, project.id, {
    enable: DEFAULT_TEAM_MODULE_IDS.filter((id): id is ModuleId => id !== 'core'),
  })
  const task = await useCases.tasks.create.execute(contextA, {
    projectId: project.id,
    title: 'Tarefa',
  })
  const blocked = await useCases.tasks.create.execute(contextA, {
    projectId: project.id,
    title: 'Bloqueada',
  })
  const archived = await useCases.tasks.create.execute(contextA, {
    projectId: project.id,
    title: 'Arquivada',
  })
  await useCases.tasks.checklist.add.execute(contextA, { taskId: task.id, title: 'Item 1' })
  await useCases.tasks.checklist.add.execute(contextA, { taskId: task.id, title: 'Item 2' })
  await useCases.tasks.checklist.add.execute(contextA, { taskId: archived.id, title: 'Antigo' })
  await useCases.tasks.criteria.add.execute(contextA, { taskId: archived.id, text: 'Antigo' })
  await useCases.tasks.archive.execute(contextA, { taskId: archived.id })
  await useCases.tasks.block.execute(contextA, { taskId: blocked.id, reason: 'Aguardando' })
  await useCases.boardSettings.setWipLimits.execute(contextA, {
    wipLimits: { in_progress: 3 },
  })
  const meeting = await useCases.meetings.create.execute(contextA, {
    title: 'Retro',
    kind: 'retro',
    date: MEETING_DATE,
    time: '09:30',
    participants: [collaboratorId],
  })
  await useCases.meetings.retroActions.add.execute(contextA, {
    meetingId: meeting.id,
    occurrenceDate: MEETING_DATE,
    title: 'Combinado',
  })
  await useCases.daily.save.execute(contextA, {
    date: TODAY,
    answers: { progress: 'Revisei', nextStep: 'Testar', blocker: '' },
  })
  // Backlog: um item não arquivado e um arquivado (que não conta).
  const backlogItem = await useCases.backlog.add.execute(contextA, {
    projectId: project.id,
    title: 'Ideia',
  })
  const backlogArchived = await useCases.backlog.add.execute(contextA, {
    projectId: project.id,
    title: 'Ideia antiga',
  })
  await useCases.tasks.archive.execute(contextA, { taskId: backlogArchived.id })
  await useCases.tasks.setEstimate.execute(contextA, {
    taskId: backlogItem.id,
    estimatedHours: 2,
  })
  await useCases.tasks.setEstimate.execute(contextA, { taskId: task.id, estimatedHours: 1.5 })
  await useCases.tasks.criteria.add.execute(contextA, { taskId: task.id, text: 'Login funciona' })
  await useCases.tasks.criteria.add.execute(contextA, { taskId: task.id, text: 'Logout funciona' })
  return { project, task }
}

describe('ferramentas da equipe: regras de ativar e desativar', () => {
  it('ativar Sprints sem Backlog ativa os dois e informa o aviso', async () => {
    const { useCases } = await setup()
    await disableForGood(useCases, ['burndown', 'reviewRetro', 'sprints', 'backlog'])

    const preview = await useCases.teamTools.previewChange.execute(contextA, {
      enable: ['sprints'],
    })
    expect(preview).toMatchObject({ ok: true, autoEnabled: ['backlog'] })

    const result = await change(useCases, { enable: ['sprints'] })
    expect(result.autoEnabled).toEqual(['backlog'])
    const states = new Map(result.view.modules.map((module) => [module.id, module.state]))
    expect(states.get('backlog')).toBe('active')
    expect(states.get('sprints')).toBe('active')
  })

  it('desligar Backlog com Sprints ativo é recusado, lista quem depende e não grava nada', async () => {
    const { useCases } = await setup()

    const error = await change(useCases, { disable: ['backlog'] }).catch(
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).message).toContain('Sprints')
    expect((await stateOf(useCases)).get('backlog')).toBe('active')
    await expect(
      useCases.teamTools.previewChange.execute(contextA, { disable: ['backlog'] }),
    ).resolves.toMatchObject({
      ok: false,
      blockedBy: ['sprints'],
      dependents: [{ module: 'backlog', requiredBy: ['sprints'] }],
    })
  })

  it('horas e pontos juntos é recusado por conflito e nada muda', async () => {
    const { useCases } = await setup()

    await expect(change(useCases, { enable: ['estimates.points'] })).rejects.toBeInstanceOf(
      ValidationError,
    )
    const error = await change(useCases, { enable: ['estimates.points'] }).catch(
      (caught: unknown) => caught,
    )
    expect((error as ValidationError).message).toContain('conflito')
    expect((await stateOf(useCases)).get('estimates.hours')).toBe('active')
    expect((await stateOf(useCases)).get('estimates.points')).toBe('disabled')
  })

  it('desativar e reativar devolve os dados intactos (checklist e limite de WIP)', async () => {
    const { useCases } = await setup()
    const { task } = await fixtures(useCases)
    const before = await useCases.tasks.getDetail.execute(contextA, { taskId: task.id })
    await useCases.tasks.checklist.toggle.execute(contextA, {
      taskId: task.id,
      itemId: before.checklist[0]!.id,
      done: true,
    })
    const checklistBefore = (
      await useCases.tasks.getDetail.execute(contextA, { taskId: task.id })
    ).checklist.map((item) => [item.title, item.done])

    await changeProject(useCases, task.projectId, { disable: ['subtasks', 'wip'] })
    await expect(useCases.boardSettings.get.execute(contextA)).rejects.toMatchObject(
      REFUSED_DISABLED,
    )

    await changeProject(useCases, task.projectId, { enable: ['subtasks', 'wip'] })
    const after = await useCases.tasks.getDetail.execute(contextA, { taskId: task.id })
    expect(after.checklist.map((item) => [item.title, item.done])).toEqual(checklistBefore)
    expect((await useCases.boardSettings.get.execute(contextA)).wipLimits).toEqual({
      in_progress: 3,
    })
  })

  it('setLevel muda o nível da equipe e devolve o aviso de ferramentas acima do nível', async () => {
    const { useCases } = await setup()

    const result = await useCases.teamTools.setLevel.execute(contextA, { level: 'basic' })

    expect(result.view.level).toBe('basic')
    expect(result.view.levelWarnings.map((warning) => warning.module)).toContain('wip')
  })
})

describe('encerramento gradual (winding_down)', () => {
  it('desligar entra em encerramento: criar é recusado e editar o que existe passa', async () => {
    const { useCases, unitOfWork } = await setup()
    const { task } = await fixtures(useCases)
    const existing = (await useCases.tasks.getDetail.execute(contextA, { taskId: task.id }))
      .checklist[0]!

    // A equipe registra o encerramento na própria configuração...
    const result = await change(useCases, { disable: ['subtasks'] })
    expect(result.windingDown).toEqual(['subtasks'])

    // ...e o efeito no guard vem do projeto: ele entra em encerramento para o caso de uso.
    await setProjectModules(unitOfWork, orgA, toProjectId(task.projectId), managerA.userId, {
      subtasks: 'winding_down',
    })
    await expect(
      useCases.tasks.checklist.add.execute(contextA, { taskId: task.id, title: 'Novo' }),
    ).rejects.toMatchObject(REFUSED_WINDING_DOWN)
    await expect(
      useCases.tasks.checklist.toggle.execute(contextA, {
        taskId: task.id,
        itemId: existing.id,
        done: true,
      }),
    ).resolves.toBeDefined()
  })

  it('completeWindDown leva a disabled e as chamadas passam a ser recusadas', async () => {
    const { useCases } = await setup()
    const { task } = await fixtures(useCases)
    await change(useCases, { disable: ['subtasks'] })

    const done = await useCases.teamTools.completeWindDown.execute(contextA, {
      moduleId: 'subtasks',
    })
    expect(done.view.modules.find((module) => module.id === 'subtasks')?.state).toBe('disabled')
    // A conclusão da equipe não mexe no projeto: o módulo do projeto desliga pelo próprio caminho.
    await expect(
      useCases.tasks.checklist.toggle.execute(contextA, {
        taskId: task.id,
        itemId: (await useCases.tasks.getDetail.execute(contextA, { taskId: task.id }))
          .checklist[0]!.id,
        done: false,
      }),
    ).resolves.toBeDefined()
    await changeProject(useCases, task.projectId, { disable: ['subtasks'] })
    await expect(
      useCases.tasks.checklist.toggle.execute(contextA, {
        taskId: task.id,
        itemId: (await useCases.tasks.getDetail.execute(contextA, { taskId: task.id }))
          .checklist[0]!.id,
        done: false,
      }),
    ).rejects.toMatchObject(REFUSED_DISABLED)
  })

  it('completeWindDown recusa ferramenta que não está encerrando', async () => {
    const { useCases } = await setup()
    await expect(
      useCases.teamTools.completeWindDown.execute(contextA, { moduleId: 'wip' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('finalize antecipa: o gestor leva o módulo direto a disabled', async () => {
    const { useCases } = await setup()
    await change(useCases, { disable: ['wip'], finalize: ['wip'] })

    expect((await stateOf(useCases)).get('wip')).toBe('disabled')
    await expect(useCases.boardSettings.get.execute(contextA)).rejects.toMatchObject(
      REFUSED_DISABLED,
    )
  })
})

describe('prévia de impacto', () => {
  it('conta o que já existe para cada ferramenta desligada e não grava nada', async () => {
    const { useCases, unitOfWork } = await setup()
    await fixtures(useCases)
    const stateBefore = await stateOf(useCases)
    const auditBefore = await unitOfWork.repositories.teamTools.listAudit(orgA, 100)

    const preview = await useCases.teamTools.previewChange.execute(contextA, {
      disable: [
        'subtasks',
        'impediments',
        'wip',
        'reviewRetro',
        'checkins',
        'agenda',
        'backlog',
        'acceptance',
        'estimates.hours',
      ],
    })

    const counts = Object.fromEntries(preview.impact.map((item) => [item.module, item.count]))
    expect(counts).toEqual({
      subtasks: 2,
      impediments: 1,
      wip: 1,
      reviewRetro: 1,
      checkins: 1,
      agenda: 1,
      backlog: 1,
      acceptance: 2,
      'estimates.hours': 2,
    })
    expect(await stateOf(useCases)).toEqual(stateBefore)
    expect(await unitOfWork.repositories.teamTools.listAudit(orgA, 100)).toEqual(auditBefore)
  })

  it('ferramenta sem dado gravado hoje tem impacto zero', async () => {
    const { useCases } = await setup()
    const preview = await useCases.teamTools.previewChange.execute(contextA, {
      disable: ['burndown'],
    })
    expect(preview.impact).toEqual([expect.objectContaining({ module: 'burndown', count: 0 })])
  })

  it('o preset na prévia usa o mesmo cálculo de ativação e encerramento', async () => {
    const { useCases } = await setup()
    const preview = await useCases.teamTools.previewChange.execute(contextA, {
      presetId: 'kanban',
    })
    expect(preview.ok).toBe(true)
    expect(preview.windingDown).toEqual(expect.arrayContaining(['backlog', 'sprints', 'checkins']))
  })
})

describe('gravação de presets e auditoria', () => {
  it('aplicar um preset mantém o nível sem pedido e aplica o sugerido só com applySuggestedLevel', async () => {
    const { useCases } = await setup()

    const kept = await useCases.teamTools.applyPreset.execute(contextA, { presetId: 'kanban' })
    expect(kept.view.level).toBe('advanced')
    expect(kept.windingDown).toContain('sprints')

    const suggested = await useCases.teamTools.applyPreset.execute(contextA, {
      presetId: 'kanban',
      applySuggestedLevel: true,
    })
    expect(suggested.view.level).toBe('basic')
  })

  it('registra ator, antes e depois de cada mudança', async () => {
    const { useCases, unitOfWork } = await setup()
    await change(useCases, { disable: ['wip'] })
    await useCases.teamTools.setLevel.execute(contextA, { level: 'basic' })
    await useCases.teamTools.applyPreset.execute(contextA, { presetId: 'kanban' })

    const entries = await unitOfWork.repositories.teamTools.listAudit(orgA, 100)
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'module_state',
          moduleId: 'wip',
          before: 'active',
          after: 'winding_down',
          actorId: managerAId,
          createdAt: NOW,
        }),
        expect.objectContaining({ kind: 'level', before: 'advanced', after: 'basic' }),
        expect.objectContaining({ kind: 'preset', moduleId: null, after: 'kanban' }),
      ]),
    )
  })
})

describe('papel: colaborador', () => {
  it('lê as ferramentas e não gerencia nada', async () => {
    const { useCases } = await setup()
    const view = await useCases.teamTools.get.execute(contextCollaborator)

    expect(view.canManage).toBe(false)
    expect(view.capabilities).toContain('tools:view')
    expect(view.capabilities).not.toContain('tools:manage')
  })

  it('é recusado em todas as operações de gestão', async () => {
    const { useCases } = await setup()
    const calls = [
      useCases.teamTools.previewChange.execute(contextCollaborator, { disable: ['wip'] }),
      useCases.teamTools.applyChange.execute(contextCollaborator, { disable: ['wip'] }),
      useCases.teamTools.completeWindDown.execute(contextCollaborator, { moduleId: 'wip' }),
      useCases.teamTools.setLevel.execute(contextCollaborator, { level: 'basic' }),
      useCases.teamTools.applyPreset.execute(contextCollaborator, { presetId: 'kanban' }),
    ]
    for (const call of calls) {
      await expect(call).rejects.toBeInstanceOf(PermissionDeniedError)
      await expect(call).rejects.toMatchObject(ONLY_MANAGER)
    }
    expect((await stateOf(useCases, contextCollaborator)).get('wip')).toBe('active')
  })
})

describe('isolamento por organização', () => {
  it('a mudança do time A não afeta o time B, e a prévia conta só o time de quem pede', async () => {
    const { useCases } = await setup()
    await fixtures(useCases)
    await useCases.teamTools.applyChange.execute(contextA, { disable: ['wip'] })

    expect((await stateOf(useCases, contextB)).get('wip')).toBe('active')
    await expect(useCases.boardSettings.get.execute(contextB)).resolves.toBeDefined()

    const preview = await useCases.teamTools.previewChange.execute(contextB, {
      disable: ['subtasks', 'wip'],
    })
    expect(preview.impact.map((item) => item.count)).toEqual([0, 0])
  })
})

describe('entrada que o caso de uso não aceita do pedido', () => {
  it('ignora userId e tenantId forjados: a gravação vai para o time e o ator da sessão', async () => {
    const { useCases, unitOfWork } = await setup()
    const forged = {
      disable: ['wip'],
      userId: managerBId,
      tenantId: orgB,
    } as TeamToolsChangeInput

    await useCases.teamTools.applyChange.execute(contextA, forged)

    const entries = await unitOfWork.repositories.teamTools.listAudit(orgA, 100)
    expect(entries.some((entry) => entry.actorId === managerAId)).toBe(true)
    expect(entries.some((entry) => entry.actorId === managerBId)).toBe(false)
    expect((await stateOf(useCases)).get('wip')).toBe('winding_down')
  })
})

describe('configuração do módulo e auditoria (regra 7)', () => {
  it('gravar o limite de sprints registra a auditoria de config com ator, antes e depois; igual não grava', async () => {
    const { useCases, unitOfWork } = await setup()
    await useCases.teamTools.setModuleConfig.execute(contextA, {
      moduleId: 'sprints',
      config: { maxActiveSprints: 2 },
    })
    await useCases.teamTools.setModuleConfig.execute(contextA, {
      moduleId: 'sprints',
      config: { maxActiveSprints: 3 },
    })
    await useCases.teamTools.setModuleConfig.execute(contextA, {
      moduleId: 'sprints',
      config: { maxActiveSprints: 3 },
    })

    const audit = await unitOfWork.repositories.teamTools.listAudit(orgA, 20)
    const configs = audit.filter((entry) => entry.kind === 'config')
    expect(configs).toHaveLength(2)
    expect(configs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          moduleId: 'sprints',
          before: null,
          after: '{"maxActiveSprints":2}',
          actorId: managerAId,
        }),
        expect.objectContaining({
          moduleId: 'sprints',
          before: '{"maxActiveSprints":2}',
          after: '{"maxActiveSprints":3}',
          actorId: managerAId,
        }),
      ]),
    )
  })

  it('desligar e reativar Sprints devolve o limite configurado', async () => {
    const { useCases, unitOfWork } = await setup()
    await useCases.teamTools.setModuleConfig.execute(contextA, {
      moduleId: 'sprints',
      config: { maxActiveSprints: 4 },
    })
    const chain = ['burndown', 'reviewRetro', 'sprints'] as const
    await change(useCases, { disable: [...chain], finalize: [...chain] })
    await change(useCases, { enable: ['sprints'] })

    const settings = await unitOfWork.repositories.teamTools.getSettings(orgA)
    expect(settings.modules.find((module) => module.moduleId === 'sprints')).toMatchObject({
      state: 'active',
      config: { maxActiveSprints: 4 },
    })
  })
})
