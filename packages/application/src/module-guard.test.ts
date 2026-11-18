import { describe, expect, it } from 'vitest'
import {
  createOrganization,
  createUser,
  DEFAULT_TEAM_MODULE_IDS,
  MODULE_IDS,
  toOrganizationId,
  toProjectId,
  toUserId,
} from '@agilebox/core'
import type { Actor, ModuleId, ModuleState, OrganizationId, UserId } from '@agilebox/core'
import { createTenantContext } from './tenant-context'
import type { TenantContext } from './tenant-context'
import { createUseCases } from './create-use-cases'
import { USE_CASE_MODULES } from './module-guard'
import type { ActorSession, TeamToolsRepository } from './ports'
import { aUser } from './testing/builders'
import { FixedClock } from './testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from './testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from './testing/fakes/recording-notifier'
import { SequentialIdGenerator } from './testing/fakes/sequential-id-generator'
import { enableProjectModules, setProjectModules } from './testing/task-harness'

const NOW = '2026-01-02T12:00:00.000Z'
const TODAY = '2026-01-02'
const MEETING_DATE = '2026-02-10'

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

/** Casos de uso que estabelecem a sessão: ficam fora da fronteira `forTenant` (ver create-use-cases.ts). */
const sessionUseCases = ['session.getCurrentActor', 'session.switchUser']

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

interface SetupOptions {
  /** Troca o repositório de ferramentas inteiro (ex.: configuração vazia). */
  teamTools?: TeamToolsRepository
  /** Envolve o repositório em memória (ex.: contar leituras). */
  wrapTeamTools?: (inner: TeamToolsRepository) => TeamToolsRepository
}

async function setup(options: SetupOptions = {}) {
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
  await repositories.users.save(
    orgA,
    createUser({ ...aUser().build(), id: collaboratorId, organizationId: orgA, name: 'Ana' }),
  )
  await repositories.users.save(
    orgA,
    createUser({
      ...aUser().build(),
      id: managerAId,
      organizationId: orgA,
      name: 'Gestora A',
      role: 'manager',
      email: 'gestora-a@example.com',
    }),
  )
  await repositories.users.save(
    orgB,
    createUser({
      ...aUser().build(),
      id: managerBId,
      organizationId: orgB,
      name: 'Gestor B',
      role: 'manager',
      email: 'gestor-b@example.com',
    }),
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
    teamTools:
      options.teamTools ??
      (options.wrapTeamTools
        ? options.wrapTeamTools(repositories.teamTools)
        : repositories.teamTools),
    projectModules: repositories.projectModules,
    projectSetup: repositories.projectSetup,
    guideProgress: repositories.guideProgress,
    sprints: repositories.sprints,
    sprintTasks: repositories.sprintTasks,
    deliverables: repositories.deliverables,
    taskDependencies: repositories.taskDependencies,
    milestones: repositories.milestones,
    risks: repositories.risks,
    baselines: repositories.baselines,
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

/**
 * Grava estados de ferramentas da EQUIPE da organização A. Só a gestão da equipe lê isso: o guard
 * olha o projeto (ADR-10), e a equipe só conta quando a organização não tem projeto ativo.
 */
async function setTeamModules(
  unitOfWork: InMemoryUnitOfWork,
  organizationId: OrganizationId,
  actorId: UserId,
  states: Partial<Record<ModuleId, ModuleState>>,
) {
  const modules = (Object.keys(states) as ModuleId[]).map((moduleId) => ({
    moduleId,
    state: states[moduleId] as ModuleState,
  }))
  await unitOfWork.repositories.teamTools.saveSettings(
    organizationId,
    { level: 'advanced', modules },
    actorId,
    NOW,
  )
}

/** Dados criados enquanto tudo está ativo, para os testes depois mudarem o estado dos módulos. */
async function fixtures(useCases: UseCases, unitOfWork: InMemoryUnitOfWork) {
  const project = await useCases.projects.createProject.execute(contextA, { name: 'Projeto' })
  // O projeto começa só com o núcleo (ADR-10): liga as ferramentas que a equipe trazia por padrão.
  await enableProjectModules(
    unitOfWork,
    orgA,
    toProjectId(project.id),
    managerAId,
    DEFAULT_TEAM_MODULE_IDS,
  )
  const task = await useCases.tasks.create.execute(contextA, {
    projectId: project.id,
    title: 'Tarefa',
  })
  // Retro: as ações de retro só existem em agendamento do tipo `retro`.
  const meeting = await useCases.meetings.create.execute(contextA, {
    title: 'Retro',
    kind: 'retro',
    date: MEETING_DATE,
    time: '09:30',
    participants: [collaboratorId],
  })
  return { project, task, meeting }
}

/** Um caso de uso representativo por módulo, com o estado que ele exige para ser recusado. */
interface Representative {
  module: ModuleId
  /** Estados em que o módulo está desligado (com as dependências que impedem desligar sozinho). */
  disabled: Partial<Record<ModuleId, ModuleState>>
  call(useCases: UseCases, fx: Awaited<ReturnType<typeof fixtures>>): Promise<unknown>
}

const REPRESENTATIVES: readonly Representative[] = [
  {
    module: 'agenda',
    // reviewRetro exige agenda: desligar a agenda exige desligar a revisão junto.
    disabled: { agenda: 'disabled', reviewRetro: 'disabled' },
    call: (u) => u.meetings.listUpcoming.execute(contextA),
  },
  {
    module: 'wip',
    disabled: { wip: 'disabled' },
    call: (u) => u.boardSettings.get.execute(contextA),
  },
  {
    module: 'subtasks',
    disabled: { subtasks: 'disabled' },
    call: (u, fx) => u.tasks.checklist.add.execute(contextA, { taskId: fx.task.id, title: 'Item' }),
  },
  {
    module: 'reviewRetro',
    disabled: { reviewRetro: 'disabled' },
    call: (u, fx) =>
      u.meetings.retroActions.list.execute(contextA, {
        meetingId: fx.meeting.id,
        occurrenceDate: MEETING_DATE,
      }),
  },
  {
    module: 'checkins',
    disabled: { checkins: 'disabled' },
    call: (u) => u.daily.getToday.execute(contextA, { date: TODAY }),
  },
  {
    module: 'impediments',
    disabled: { impediments: 'disabled' },
    call: (u, fx) => u.tasks.block.execute(contextA, { taskId: fx.task.id, reason: 'Aguardando' }),
  },
  {
    module: 'flowMetrics',
    disabled: { flowMetrics: 'disabled' },
    call: (u) => u.tasks.getBoardFlow.execute(contextA, {}),
  },
  {
    module: 'definitionOfDone',
    disabled: { definitionOfDone: 'disabled' },
    call: (u, fx) =>
      u.projects.definitionOfDone.list.execute(contextA, { projectId: fx.project.id }),
  },
]

describe('guard de módulo: um caso de uso representativo por módulo', () => {
  for (const representative of REPRESENTATIVES) {
    it(`${representative.module}: recusa com desativado e executa com ativo`, async () => {
      const { useCases, unitOfWork } = await setup()
      const fx = await fixtures(useCases, unitOfWork)

      await setProjectModules(
        unitOfWork,
        orgA,
        toProjectId(fx.project.id),
        managerAId,
        representative.disabled,
      )
      await expect(representative.call(useCases, fx)).rejects.toMatchObject(REFUSED_DISABLED)

      const reactivated = Object.fromEntries(
        Object.keys(representative.disabled).map((id) => [id, 'active' as const]),
      ) as Partial<Record<ModuleId, ModuleState>>
      await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, reactivated)
      await expect(representative.call(useCases, fx)).resolves.toBeDefined()
    })
  }
})

describe('guard de módulo: encerramento (winding_down)', () => {
  it('subtarefas: o que já existe segue editável e a criação é recusada', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    await useCases.tasks.checklist.add.execute(contextA, {
      taskId: fx.task.id,
      title: 'Item antigo',
    })
    const itemId = (await useCases.tasks.getDetail.execute(contextA, { taskId: fx.task.id }))
      .checklist[0]!.id

    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      subtasks: 'winding_down',
    })

    await expect(
      useCases.tasks.checklist.toggle.execute(contextA, {
        taskId: fx.task.id,
        itemId,
        done: true,
      }),
    ).resolves.toBeDefined()
    await expect(
      useCases.tasks.checklist.rename.execute(contextA, {
        taskId: fx.task.id,
        itemId,
        title: 'Item renomeado',
      }),
    ).resolves.toBeDefined()
    await expect(
      useCases.tasks.checklist.add.execute(contextA, { taskId: fx.task.id, title: 'Novo' }),
    ).rejects.toMatchObject(REFUSED_WINDING_DOWN)

    const detail = await useCases.tasks.getDetail.execute(contextA, { taskId: fx.task.id })
    expect(detail.checklist.map((item) => [item.title, item.done])).toEqual([
      ['Item renomeado', true],
    ])
  })

  it('impedimentos: desbloquear segue permitido e bloquear é recusado', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    await useCases.tasks.block.execute(contextA, { taskId: fx.task.id, reason: 'Aguardando' })

    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      impediments: 'winding_down',
    })

    await expect(
      useCases.tasks.unblock.execute(contextA, { taskId: fx.task.id }),
    ).resolves.toBeDefined()
    await expect(
      useCases.tasks.block.execute(contextA, { taskId: fx.task.id, reason: 'Outro' }),
    ).rejects.toMatchObject(REFUSED_WINDING_DOWN)
  })

  it('check-ins: ler a daily segue permitido e criar a daily do dia é recusado', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      checkins: 'winding_down',
    })

    await expect(useCases.daily.getToday.execute(contextA, { date: TODAY })).resolves.toBeDefined()
    await expect(
      useCases.daily.save.execute(contextA, {
        date: TODAY,
        answers: { progress: 'Testei', nextStep: 'Revisar', blocker: '' },
      }),
    ).rejects.toMatchObject(REFUSED_WINDING_DOWN)
  })

  it('check-ins encerrando: editar a daily que já existe no dia segue permitido', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    await useCases.daily.save.execute(contextA, {
      date: TODAY,
      answers: { progress: 'Primeira versão', nextStep: 'Revisar', blocker: '' },
    })

    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      checkins: 'winding_down',
    })

    const edited = await useCases.daily.save.execute(contextA, {
      date: TODAY,
      answers: { progress: 'Segunda versão', nextStep: 'Revisar', blocker: '' },
    })
    expect(edited.answers.progress).toBe('Segunda versão')
    const today = await useCases.daily.getToday.execute(contextA, { date: TODAY })
    expect(today.entry?.answers.progress).toBe('Segunda versão')
  })

  it('check-ins desligado: editar a daily existente também é recusado', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    await useCases.daily.save.execute(contextA, {
      date: TODAY,
      answers: { progress: 'Versão', nextStep: 'Revisar', blocker: '' },
    })

    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      checkins: 'disabled',
    })

    await expect(
      useCases.daily.save.execute(contextA, {
        date: TODAY,
        answers: { progress: 'Outra', nextStep: 'Revisar', blocker: '' },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('limite de WIP: os limites seguem editáveis e lidos (não criam item)', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      wip: 'winding_down',
    })

    await expect(
      useCases.boardSettings.setWipLimits.execute(contextA, { wipLimits: { in_progress: 3 } }),
    ).resolves.toBeDefined()
    await expect(useCases.boardSettings.get.execute(contextA)).resolves.toBeDefined()
  })

  it('ações de retro: alterar e listar segue permitido e adicionar é recusado', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    const action = await useCases.meetings.retroActions.add.execute(contextA, {
      meetingId: fx.meeting.id,
      occurrenceDate: MEETING_DATE,
      title: 'Ação antiga',
    })

    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      reviewRetro: 'winding_down',
    })

    await expect(
      useCases.meetings.retroActions.toggle.execute(contextA, { actionId: action.id, done: true }),
    ).resolves.toBeDefined()
    await expect(
      useCases.meetings.retroActions.list.execute(contextA, {
        meetingId: fx.meeting.id,
        occurrenceDate: MEETING_DATE,
      }),
    ).resolves.toBeDefined()
    await expect(
      useCases.meetings.retroActions.add.execute(contextA, {
        meetingId: fx.meeting.id,
        occurrenceDate: MEETING_DATE,
        title: 'Ação nova',
      }),
    ).rejects.toMatchObject(REFUSED_WINDING_DOWN)
  })
  it('definição de pronto: encerrando, renomear e ler seguem e adicionar é recusado', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    const projectId = toProjectId(fx.project.id)
    await setProjectModules(unitOfWork, orgA, projectId, managerAId, { definitionOfDone: 'active' })
    const [item] = await useCases.projects.definitionOfDone.add.execute(contextA, {
      projectId: fx.project.id,
      title: 'Testes passando',
    })

    await setProjectModules(unitOfWork, orgA, projectId, managerAId, {
      definitionOfDone: 'winding_down',
    })
    await expect(
      useCases.projects.definitionOfDone.add.execute(contextA, {
        projectId: fx.project.id,
        title: 'Outro item',
      }),
    ).rejects.toMatchObject(REFUSED_WINDING_DOWN)
    await expect(
      useCases.projects.definitionOfDone.rename.execute(contextA, {
        projectId: fx.project.id,
        itemId: item!.id,
        title: 'Testes automatizados',
      }),
    ).resolves.toBeDefined()
    await expect(
      useCases.projects.definitionOfDone.list.execute(contextA, { projectId: fx.project.id }),
    ).resolves.toHaveLength(1)
  })
})

describe('guard de módulo: núcleo', () => {
  it('núcleo nunca é recusado, com todos os outros módulos desligados', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    const allOff = Object.fromEntries(
      MODULE_IDS.filter((id) => id !== 'core').map((id) => [id, 'disabled' as const]),
    ) as Partial<Record<ModuleId, ModuleState>>
    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, allOff)

    await expect(useCases.projects.listProjects.execute(contextA)).resolves.toBeDefined()
    await expect(
      useCases.tasks.create.execute(contextA, { projectId: fx.project.id, title: 'Nova' }),
    ).resolves.toBeDefined()
    await expect(useCases.tasks.listBoard.execute(contextA, {})).resolves.toBeDefined()
    await expect(
      useCases.tasks.getDetail.execute(contextA, { taskId: fx.task.id }),
    ).resolves.toBeDefined()
    await expect(
      useCases.timeline.list.execute(contextA, { taskId: fx.task.id }),
    ).resolves.toBeDefined()
    await expect(useCases.dashboard.get.execute(contextA)).resolves.toBeDefined()
  })

  it('sem nenhuma linha gravada, o núcleo roda sem consultar a configuração', async () => {
    let reads = 0
    const emptyTeamTools: TeamToolsRepository = {
      getSettings: () => {
        reads += 1
        return Promise.resolve({ level: 'advanced', modules: [] })
      },
      saveSettings: () => Promise.reject(new Error('não usado neste teste')),
      listAudit: () => Promise.resolve([]),
    }
    const { useCases } = await setup({ teamTools: emptyTeamTools })

    const project = await useCases.projects.createProject.execute(contextA, { name: 'Sem linhas' })
    await useCases.tasks.listBoard.execute(contextA, {})
    await useCases.tasks.create.execute(contextA, { projectId: project.id, title: 'Núcleo' })
    expect(reads).toBe(0)

    // Projeto sem linha conta como desligado, e a equipe não entra: o projeto decide, sem leitura.
    await expect(useCases.boardSettings.get.execute(contextA)).rejects.toMatchObject(
      REFUSED_DISABLED,
    )
    expect(reads).toBe(0)
  })

  it('sem nenhum projeto ativo, a regra da equipe vale (compatibilidade): uma leitura', async () => {
    let reads = 0
    const emptyTeamTools: TeamToolsRepository = {
      getSettings: () => {
        reads += 1
        return Promise.resolve({ level: 'advanced', modules: [] })
      },
      saveSettings: () => Promise.reject(new Error('não usado neste teste')),
      listAudit: () => Promise.resolve([]),
    }
    const { useCases } = await setup({ teamTools: emptyTeamTools })

    // Nenhum projeto: linha ausente na equipe conta como desligado, e a leitura acontece uma vez.
    await expect(useCases.boardSettings.get.execute(contextA)).rejects.toMatchObject(
      REFUSED_DISABLED,
    )
    expect(reads).toBe(1)
  })

  it('uma chamada de módulo lê a configuração exatamente uma vez', async () => {
    let reads = 0
    const { useCases } = await setup({
      wrapTeamTools: (inner) => ({
        getSettings: (organizationId) => {
          reads += 1
          return inner.getSettings(organizationId)
        },
        saveSettings: inner.saveSettings.bind(inner),
        listAudit: inner.listAudit.bind(inner),
      }),
    })

    await useCases.boardSettings.get.execute(contextA)
    expect(reads).toBe(1)
  })
})

describe('guard de módulo: reativar devolve os dados como estavam', () => {
  it('subtarefas: desativar esconde e reativar devolve o mesmo checklist', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    await useCases.tasks.checklist.add.execute(contextA, { taskId: fx.task.id, title: 'Item' })
    const before = await useCases.tasks.getDetail.execute(contextA, { taskId: fx.task.id })

    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      subtasks: 'disabled',
    })
    await expect(
      useCases.tasks.checklist.add.execute(contextA, { taskId: fx.task.id, title: 'Outro' }),
    ).rejects.toMatchObject(REFUSED_DISABLED)
    // O núcleo continua mostrando o checklist guardado enquanto o módulo está desligado.
    const hidden = await useCases.tasks.getDetail.execute(contextA, { taskId: fx.task.id })
    expect(hidden.checklist).toEqual(before.checklist)

    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      subtasks: 'active',
    })
    const after = await useCases.tasks.getDetail.execute(contextA, { taskId: fx.task.id })
    expect(after).toEqual(before)
  })

  it('limite de WIP: desativar e reativar devolve os limites gravados', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    await useCases.boardSettings.setWipLimits.execute(contextA, {
      wipLimits: { in_progress: 2 },
    })
    const before = await useCases.boardSettings.get.execute(contextA)

    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      wip: 'disabled',
    })
    await expect(useCases.boardSettings.get.execute(contextA)).rejects.toMatchObject(
      REFUSED_DISABLED,
    )

    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      wip: 'active',
    })
    await expect(useCases.boardSettings.get.execute(contextA)).resolves.toEqual(before)
  })
})

describe('guard de módulo: isolamento por organização', () => {
  it('desligar um módulo no projeto do time A não afeta o time B', async () => {
    const { useCases, unitOfWork } = await setup()
    const fxA = await fixtures(useCases, unitOfWork)
    const fxB = await useCases.projects.createProject.execute(contextB, { name: 'Projeto B' })
    await enableProjectModules(unitOfWork, orgB, toProjectId(fxB.id), managerBId, [
      'wip',
      'subtasks',
    ])
    const taskB = await useCases.tasks.create.execute(contextB, {
      projectId: fxB.id,
      title: 'Tarefa B',
    })

    await setProjectModules(unitOfWork, orgA, toProjectId(fxA.project.id), managerAId, {
      wip: 'disabled',
      subtasks: 'disabled',
    })

    await expect(useCases.boardSettings.get.execute(contextA)).rejects.toMatchObject(
      REFUSED_DISABLED,
    )
    await expect(useCases.boardSettings.get.execute(contextB)).resolves.toBeDefined()
    await expect(
      useCases.tasks.checklist.add.execute(contextB, { taskId: taskB.id, title: 'Item B' }),
    ).resolves.toBeDefined()
  })
})

describe('guard de módulo por projeto (ADR-10)', () => {
  it('módulo ligado só em outro projeto não vale: a tarefa do projeto sem o módulo é recusada', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    // Segundo projeto só com o núcleo: nele, subtarefas e impedimentos estão desligados.
    const other = await useCases.projects.createProject.execute(contextA, { name: 'Outro' })
    const otherTask = await useCases.tasks.create.execute(contextA, {
      projectId: other.id,
      title: 'Tarefa do outro',
    })

    await expect(
      useCases.tasks.checklist.add.execute(contextA, { taskId: otherTask.id, title: 'Item' }),
    ).rejects.toMatchObject(REFUSED_DISABLED)
    await expect(
      useCases.tasks.block.execute(contextA, { taskId: otherTask.id, reason: 'Aguardando' }),
    ).rejects.toMatchObject(REFUSED_DISABLED)
    // A tarefa do projeto que tem o módulo segue normal.
    await expect(
      useCases.tasks.checklist.add.execute(contextA, { taskId: fx.task.id, title: 'Item' }),
    ).resolves.toBeDefined()
  })

  it('impedimentId resolve o projeto pela tarefa do impedimento', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    const other = await useCases.projects.createProject.execute(contextA, { name: 'Outro' })
    await enableProjectModules(unitOfWork, orgA, toProjectId(other.id), managerAId, ['impediments'])
    const otherTask = await useCases.tasks.create.execute(contextA, {
      projectId: other.id,
      title: 'Tarefa do outro',
    })
    const blockedHere = await useCases.tasks.block.execute(contextA, {
      taskId: fx.task.id,
      reason: 'Aqui',
    })
    expect(blockedHere.id).toBe(fx.task.id)
    await useCases.tasks.block.execute(contextA, { taskId: otherTask.id, reason: 'Lá' })
    const [here, there] = await useCases.impediments.list.execute(contextA, {})
    const impedimentHere = here!.taskId === fx.task.id ? here! : there!
    const impedimentThere = here!.taskId === fx.task.id ? there! : here!

    // Desliga Impedimentos só no projeto da primeira tarefa: resolver lá recusa, lá fora segue.
    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      impediments: 'disabled',
    })
    await expect(
      useCases.impediments.resolve.execute(contextA, { impedimentId: impedimentHere.id }),
    ).rejects.toMatchObject(REFUSED_DISABLED)
    await expect(
      useCases.impediments.resolve.execute(contextA, { impedimentId: impedimentThere.id }),
    ).resolves.toBeDefined()
  })

  it('caso sem projeto vale se algum projeto ativo tem o módulo', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    // Segundo projeto sem limites de WIP: o quadro inteiro segue com o módulo, pelo projeto que tem.
    await useCases.projects.createProject.execute(contextA, { name: 'Sem WIP' })
    await expect(useCases.boardSettings.get.execute(contextA)).resolves.toBeDefined()

    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      wip: 'disabled',
    })
    await expect(useCases.boardSettings.get.execute(contextA)).rejects.toMatchObject(
      REFUSED_DISABLED,
    )
  })

  it('winding_down em um projeto e desligado no outro: caso sem projeto recusa criar e deixa ler', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    await useCases.projects.createProject.execute(contextA, { name: 'Sem check-in' })
    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      checkins: 'winding_down',
    })

    await expect(useCases.daily.getToday.execute(contextA, { date: TODAY })).resolves.toBeDefined()
    await expect(
      useCases.daily.save.execute(contextA, {
        date: TODAY,
        answers: { progress: 'Testei', nextStep: 'Revisar', blocker: '' },
      }),
    ).rejects.toMatchObject(REFUSED_WINDING_DOWN)
  })

  it('a equipe não entra na conta quando a organização tem projeto ativo', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)

    // Equipe desligou WIP, mas o projeto tem: vale o projeto.
    await setTeamModules(unitOfWork, orgA, managerAId, { wip: 'disabled' })
    await expect(useCases.boardSettings.get.execute(contextA)).resolves.toBeDefined()

    // Equipe ligou, mas o projeto não tem: vale o projeto.
    await setTeamModules(unitOfWork, orgA, managerAId, { wip: 'active' })
    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      wip: 'disabled',
    })
    await expect(useCases.boardSettings.get.execute(contextA)).rejects.toMatchObject(
      REFUSED_DISABLED,
    )
  })

  it('projeto de outra organização não vaza: a recusa não aparece para quem não é dono', async () => {
    const { useCases, unitOfWork } = await setup()
    const fx = await fixtures(useCases, unitOfWork)
    // Subtarefas desligadas no projeto do time A: quem está fora não deve ver isso como recusa.
    await setProjectModules(unitOfWork, orgA, toProjectId(fx.project.id), managerAId, {
      subtasks: 'disabled',
    })

    await expect(
      useCases.tasks.checklist.add.execute(contextB, { taskId: fx.task.id, title: 'Vazado' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCases.backlog.list.execute(contextB, { projectId: fx.project.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // Projeto que não existe também segue para o caso de uso, que responde não encontrado.
    await expect(
      useCases.backlog.list.execute(contextA, {
        projectId: toProjectId('00000000000000000000000099'),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('mapa de módulos dos casos de uso', () => {
  type UseCaseLike = { execute: (context: unknown, input: unknown) => unknown }

  /** Coleta as folhas registradas (objetos com `execute`) com o caminho de cada uma. */
  function collectUseCases(node: object, path = ''): string[] {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]): string[] => {
      const current = path === '' ? key : `${path}.${key}`
      if (typeof value !== 'object' || value === null) return []
      if ('execute' in value && typeof (value as UseCaseLike).execute === 'function')
        return [current]
      return collectUseCases(value, current)
    })
  }

  it('todo caso de uso registrado em createUseCases tem declaração no mapa, e o mapa não tem sobra', async () => {
    const { useCases } = await setup()
    const registered = collectUseCases(useCases)
      .filter((path) => !sessionUseCases.includes(path))
      .sort()

    // 103 + 9 da EAP e dos marcos (ADR-10, fase 3, A2): 5 de `wbs`, `tasks.setDeliverable` e 3 de `milestones`.
    // Mais 1: `milestones.list`, a leitura dos marcos (módulo `milestones`).
    // Mais 4 do cronograma (ADR-10, fase 3, A4): `tasks.setStart`, `schedule.get`, `schedule.addDependency`
    // e `schedule.removeDependency`. Mais 1: `tracking.get`, o acompanhamento (módulo `schedule`).
    // Mais 1: `burndown.get`, o burndown e a velocidade (módulo `burndown`).
    // Mais 1: `flowMetrics.get`, as métricas de fluxo por projeto (módulo `flowMetrics`).
    // Mais 4: `risks.list`, `risks.create`, `risks.update` e `risks.remove` (módulo `risks`, ADR-10).
    // Mais 2: `baseline.get` e `baseline.take` (módulo `baseline`, ADR-10).
    expect(registered).toHaveLength(126)
    expect(Object.keys(USE_CASE_MODULES).sort()).toEqual(registered)
  })

  it('só módulos do catálogo e exatamente os casos que criam itens estão marcados como criação', () => {
    const modules = new Set<string>(MODULE_IDS)
    for (const policy of Object.values(USE_CASE_MODULES)) {
      expect(modules.has(policy.module)).toBe(true)
    }
    const creates = Object.entries(USE_CASE_MODULES)
      .filter(([, policy]) => 'creates' in policy && policy.creates === true)
      .map(([path]) => path)
      .sort()
    expect(creates).toEqual([
      'backlog.add',
      'baseline.take',
      'meetings.create',
      'meetings.retroActions.add',
      'milestones.create',
      'projects.definitionOfDone.add',
      'risks.create',
      'schedule.addDependency',
      'sprints.addTask',
      'sprints.create',
      'sprints.start',
      'tasks.block',
      'tasks.checklist.add',
      'tasks.criteria.add',
      'wbs.createDeliverable',
    ])
  })

  it('todo caso de uso declara de onde sai o projeto, e os casos de exemplo batem com a regra', () => {
    for (const [path, policy] of Object.entries(USE_CASE_MODULES)) {
      expect(policy.project, path).toBeDefined()
    }
    expect(USE_CASE_MODULES['sprints.close'].project).toEqual({ from: 'sprintId' })
    expect(USE_CASE_MODULES['backlog.add'].project).toEqual({ from: 'projectId' })
    expect(USE_CASE_MODULES['tasks.criteria.add'].project).toEqual({ from: 'taskId' })
    expect(USE_CASE_MODULES['impediments.resolve'].project).toEqual({ from: 'impedimentId' })
    expect(USE_CASE_MODULES['impediments.list'].project).toBe('none')
    expect(USE_CASE_MODULES['meetings.create'].project).toBe('none')
    expect(USE_CASE_MODULES['daily.save'].project).toBe('none')
  })

  it('o núcleo é o módulo de todos os casos que não dependem de ferramenta', () => {
    const core = Object.entries(USE_CASE_MODULES)
      .filter(([, policy]) => policy.module === 'core')
      .map(([path]) => path)
    expect(core).toContain('tasks.create')
    expect(core).toContain('projects.createProject')
    expect(core).toContain('dashboard.get')
    expect(core).not.toContain('tasks.getBoardFlow')
  })
})
