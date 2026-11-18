import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import type {
  BurndownViewDto,
  MeetingDto,
  ProjectDto,
  SprintDetailDto,
  SprintDto,
  TaskDto,
} from '@agilebox/contract'
import type { ModuleId } from '@agilebox/core'
import { createFakeApi } from '../../shared/testing/fake-api'
import { presetModules, teamToolsView } from '../../shared/testing/team-tools-fixture'
import { renderPanel, settleCapabilities } from '../../shared/testing/render-panel'
import { todayDateOnly } from '../../shared/lib/today'
import type { PanelView } from '../layout/PanelShell'
import { SprintsView } from './SprintsView'
import { sprintCopy } from './sprint-copy'

/**
 * Tela de Sprints com o backend em memória dos testes: abas Planejamento, Ativa e Encerradas,
 * formulário, itens, início, encerramento com as duas políticas e replanejamento.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'
const MANAGER_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5V09'
const SCRUM = presetModules('scrum')

const PROJECT: ProjectDto = {
  id: PROJECT_ID,
  name: 'Projeto Aurora',
  createdBy: MANAGER_ID,
  createdAt: '2026-10-31T12:00:00.000Z',
  definitionOfDoneCount: 0,
  archivedAt: null,
}

const sprintId = (n: number) => `01J8Y4G2XK8Z1S6M3Q9W0S${String(n).padStart(3, '0')}`
const taskId = (n: number) => `01J8Y4G2XK8Z1S6M3Q9W0BK${String(n).padStart(2, '0')}`

function sprintDto(overrides: Partial<SprintDto> & { number: number }): SprintDto {
  return {
    id: sprintId(overrides.number),
    projectId: PROJECT_ID,
    label: `Sprint ${overrides.number}`,
    name: `Sprint ${overrides.number}`,
    goal: null,
    plannedStart: '2026-11-02',
    plannedEnd: '2026-11-15',
    status: 'draft',
    startedAt: null,
    closedAt: null,
    closePolicy: null,
    createdBy: MANAGER_ID,
    createdAt: '2026-10-31T12:00:00.000Z',
    ...overrides,
  }
}

function task(n: number, title: string, overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: taskId(n),
    number: n,
    key: `AB-${n}`,
    projectId: PROJECT_ID,
    projectName: 'Projeto Aurora',
    title,
    description: '',
    status: 'todo',
    priority: 'normal',
    blockedReason: null,
    blockedAt: null,
    archivedAt: null,
    backlogRank: n,
    inBacklog: false,
    estimatedHours: null,
    actualHours: 0,
    deadline: null,
    ticketId: null,
    ticketUrl: null,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    checklistProgress: { done: 0, total: 0, percent: 0 },
    commentCount: 0,
    sprint: null,
    ...overrides,
  }
}

function detail(
  sprint: SprintDto,
  items: TaskDto[] = [],
  history: SprintDetailDto['history'] = [],
): SprintDetailDto {
  return { sprint, items, history }
}

interface Options {
  readonly sprints?: SprintDto[]
  readonly details?: Record<string, SprintDetailDto>
  readonly backlog?: TaskDto[]
  readonly winding?: boolean
  readonly modules?: readonly ModuleId[]
  readonly level?: 'basic' | 'intermediate' | 'advanced'
  /** Quem está logado: gestor (padrão) ou colaborador. */
  readonly manager?: boolean
  /** Membros do projeto (um colaborador só vê projeto de que participa). */
  readonly members?: readonly { readonly id: string }[]
  /** Burndown do projeto (velocidade, dia e atraso). */
  readonly burndown?: BurndownViewDto
  readonly onNavigate?: (view: PanelView) => void
  readonly onNewTask?: () => void
}

function setup({
  sprints = [],
  details = {},
  backlog = [],
  winding = false,
  level = 'intermediate',
  modules,
  manager = true,
  members,
  burndown,
  onNavigate,
  onNewTask,
}: Options = {}) {
  const onOpenTask = vi.fn()
  const api = createFakeApi()
  if (members) {
    vi.spyOn(api.projects, 'listMembers').mockResolvedValue(
      members.map((member) => ({
        ...member,
        name: 'Pessoa',
        initials: 'PE',
        role: 'collaborator',
      })),
    )
  }
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: MANAGER_ID,
    organizationId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDG',
    role: manager ? 'manager' : 'collaborator',
  })
  vi.spyOn(api.sprints, 'list').mockImplementation(() => Promise.resolve([...sprints]))
  vi.spyOn(api.sprints, 'get').mockImplementation(({ sprintId: id }) => {
    const found = details[id]
    return found
      ? Promise.resolve(found)
      : Promise.reject(new ApiError('NOT_FOUND', 'Sprint não encontrada'))
  })
  vi.spyOn(api.backlog, 'list').mockImplementation(() => Promise.resolve([...backlog]))
  if (burndown) vi.spyOn(api.burndown, 'get').mockResolvedValue(burndown)
  // Em encerramento, `sprints` sai da lista de ativos e entra como `winding_down` (como o servidor faz).
  const tools = teamToolsView({
    modules: modules ?? (winding ? SCRUM.filter((id) => id !== 'sprints') : [...SCRUM]),
    level,
    role: manager ? 'manager' : 'collaborator',
    winding: winding ? ['sprints'] : [],
  })
  renderPanel(
    <SprintsView
      initialProjectId={PROJECT_ID}
      projects={[PROJECT]}
      isManager={manager}
      onOpenTask={onOpenTask}
      {...(onNavigate ? { onNavigate } : {})}
      {...(onNewTask ? { onNewTask } : {})}
    />,
    { api, tools },
  )
  return { api, onOpenTask }
}

async function ready(api: ReturnType<typeof createFakeApi>) {
  await settleCapabilities(api)
  await screen.findByRole('group', { name: sprintCopy.tabsLabel })
}

async function goTo(
  user: ReturnType<typeof userEvent.setup>,
  tab: 'Planejamento' | 'Ativa' | 'Encerradas',
) {
  await user.click(screen.getByRole('button', { name: tab }))
}

describe('Planejamento: rascunhos e formulário', () => {
  it('valida o rascunho com as mensagens pt-BR antes de criar', async () => {
    const user = userEvent.setup()
    const { api } = setup()
    const create = vi.spyOn(api.sprints, 'create')
    await ready(api)
    await user.click(await screen.findByRole('button', { name: sprintCopy.newSprint }))
    await user.click(screen.getByRole('button', { name: sprintCopy.formCreate }))
    expect(screen.getByText('Informe a data de início.')).toBeTruthy()
    expect(screen.getByText('Informe a data de fim.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText(sprintCopy.plannedStartLabel), {
      target: { value: '2026-11-20' },
    })
    fireEvent.change(screen.getByLabelText(sprintCopy.plannedEndLabel), {
      target: { value: '2026-11-10' },
    })
    await user.click(screen.getByRole('button', { name: sprintCopy.formCreate }))
    expect(screen.getByText('A data de início não pode ser depois da data de fim')).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })

  it('cria com nome e meta opcionais e envia o que foi digitado', async () => {
    const user = userEvent.setup()
    const created = sprintDto({ number: 1, status: 'draft' })
    const { api } = setup({
      details: { [created.id]: detail(created) },
    })
    const create = vi.spyOn(api.sprints, 'create').mockResolvedValue(detail(created))
    await ready(api)
    await user.click(await screen.findByRole('button', { name: sprintCopy.newSprint }))
    await user.type(screen.getByLabelText(sprintCopy.nameLabel), '  Login  ')
    await user.type(screen.getByLabelText(sprintCopy.goalLabel), 'Entregar login')
    fireEvent.change(screen.getByLabelText(sprintCopy.plannedStartLabel), {
      target: { value: '2026-11-16' },
    })
    fireEvent.change(screen.getByLabelText(sprintCopy.plannedEndLabel), {
      target: { value: '2026-11-29' },
    })
    await user.click(screen.getByRole('button', { name: sprintCopy.formCreate }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        name: 'Login',
        goal: 'Entregar login',
        plannedStart: '2026-11-16',
        plannedEnd: '2026-11-29',
      }),
    )
  })

  it('edita, descarta e mostra a lista vazia com a ação de nova sprint', async () => {
    const user = userEvent.setup()
    const draft = sprintDto({ number: 2, name: 'Sprint 2', goal: 'Meta antiga' })
    const { api } = setup({ sprints: [draft], details: { [draft.id]: detail(draft) } })
    const discard = vi.spyOn(api.sprints, 'discard').mockResolvedValue({ sprintId: draft.id })
    await ready(api)
    await screen.findByRole('heading', { name: sprintCopy.planningTitle('Sprint 2') })
    expect(screen.getByText('Meta antiga')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: sprintCopy.discard }))
    await user.click(screen.getByRole('button', { name: sprintCopy.discardConfirm }))
    await waitFor(() => expect(discard).toHaveBeenCalledWith({ sprintId: draft.id }))
  })
})

describe('Planejamento: itens do backlog', () => {
  it('adiciona um item do backlog ao rascunho e remove outro', async () => {
    const user = userEvent.setup()
    const draft = sprintDto({ number: 3 })
    const inSprint = task(1, 'Ajustar relatório', {
      sprint: { id: draft.id, number: 3, name: 'Sprint 3', status: 'draft' },
    })
    const backlogItem = task(2, 'Trocar ícone', { inBacklog: true })
    const { api } = setup({
      sprints: [draft],
      details: { [draft.id]: detail(draft, [inSprint]) },
      backlog: [inSprint, backlogItem],
    })
    const add = vi
      .spyOn(api.sprints, 'addTask')
      .mockResolvedValue(detail(draft, [inSprint, backlogItem]))
    const remove = vi.spyOn(api.sprints, 'removeTask').mockResolvedValue(detail(draft, []))
    await ready(api)
    await screen.findByRole('heading', { name: sprintCopy.planningTitle('Sprint 3') })
    await user.click(
      await screen.findByRole('button', { name: sprintCopy.backlogAdd('Trocar ícone') }),
    )
    expect(add).toHaveBeenCalledWith({ sprintId: draft.id, taskId: backlogItem.id })
    await user.click(
      screen.getByRole('button', { name: sprintCopy.removeItem('Ajustar relatório') }),
    )
    expect(remove).toHaveBeenCalledWith({ sprintId: draft.id, taskId: inSprint.id })
  })

  it('não oferece adicionar item que já está em outra sprint aberta', async () => {
    const draft = sprintDto({ number: 3 })
    const busy = task(3, 'Já planejado', {
      sprint: { id: sprintId(9), number: 9, name: 'Sprint 9', status: 'draft' },
    })
    const { api } = setup({
      sprints: [draft],
      details: { [draft.id]: detail(draft) },
      backlog: [busy],
    })
    await ready(api)
    await screen.findByRole('heading', { name: sprintCopy.planningTitle('Sprint 3') })
    const button = await screen.findByRole('button', {
      name: sprintCopy.backlogAdd('Já planejado'),
    })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(sprintCopy.backlogBusy('Sprint 9'))).toBeTruthy()
  })
})

describe('Iniciar sprint', () => {
  it('mostra o limite de sprints ativas em pt-BR sem quebrar a tela', async () => {
    const user = userEvent.setup()
    const draft = sprintDto({ number: 4 })
    const { api } = setup({ sprints: [draft], details: { [draft.id]: detail(draft) } })
    vi.spyOn(api.sprints, 'start').mockRejectedValue(
      new ApiError(
        'CONFLICT',
        'Já existe uma sprint ativa neste projeto. Encerre-a antes de iniciar outra',
      ),
    )
    await ready(api)
    await screen.findByRole('heading', { name: sprintCopy.planningTitle('Sprint 4') })
    await user.click(screen.getByRole('button', { name: sprintCopy.start }))
    expect(
      await screen.findByText(
        'Já existe uma sprint ativa neste projeto. Encerre-a antes de iniciar outra',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: sprintCopy.start })).toBeTruthy()
  })
})

describe('Ativa: progresso e mini-quadro', () => {
  const active = sprintDto({
    number: 5,
    status: 'active',
    startedAt: '2026-11-03T10:00:00.000Z',
    goal: 'Fechar o login',
  })
  const done = task(10, 'Feito', {
    status: 'done',
    estimatedHours: 2,
    actualHours: 1.5,
    sprint: { id: active.id, number: 5, name: 'Sprint 5', status: 'active' },
  })
  const doing = task(11, 'Em curso', {
    status: 'in_progress',
    estimatedHours: 3,
    sprint: { id: active.id, number: 5, name: 'Sprint 5', status: 'active' },
  })
  const late = task(12, 'Entrou depois', {
    status: 'todo',
    sprint: { id: active.id, number: 5, name: 'Sprint 5', status: 'active' },
  })
  const history: SprintDetailDto['history'] = [
    {
      taskId: done.id,
      taskKey: 'AB-10',
      taskTitle: 'Feito',
      addedAt: '2026-11-02T09:00:00.000Z',
      addedBy: MANAGER_ID,
      removedAt: null,
      removedBy: null,
      outcome: 'open',
    },
    {
      taskId: late.id,
      taskKey: 'AB-12',
      taskTitle: 'Entrou depois',
      addedAt: '2026-11-05T09:00:00.000Z',
      addedBy: MANAGER_ID,
      removedAt: null,
      removedBy: null,
      outcome: 'open',
    },
  ]

  it('mostra progresso, horas, colunas com contagem e sinaliza o item adicionado no meio', async () => {
    const user = userEvent.setup()
    const { api, onOpenTask } = setup({
      sprints: [active],
      details: { [active.id]: detail(active, [done, doing, late], history) },
    })
    await ready(api)
    await goTo(user, 'Ativa')
    expect(await screen.findByText(sprintCopy.progress(1, 3))).toBeTruthy()
    expect(screen.getByText(sprintCopy.hoursEstimatedActual('5 h', '1,5 h'))).toBeTruthy()
    const board = screen.getByRole('region', { name: 'Concluído' })
    expect(within(board).getByText('Feito')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Desenvolvendo' })).toBeTruthy()
    const todo = screen.getByRole('region', { name: 'A fazer' })
    expect(within(todo).getByText(sprintCopy.addedMidSprint)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: sprintCopy.openItem('Em curso') }))
    expect(onOpenTask).toHaveBeenCalledWith(doing.id)
  })
})

describe('Ativa: encerrar com as duas políticas', () => {
  const active = sprintDto({ number: 5, status: 'active', startedAt: '2026-11-03T10:00:00.000Z' })
  const todo = task(20, 'Ainda não começou', {
    status: 'todo',
    sprint: { id: active.id, number: 5, name: 'Sprint 5', status: 'active' },
  })
  const doing = task(21, 'Já começou', {
    status: 'in_progress',
    sprint: { id: active.id, number: 5, name: 'Sprint 5', status: 'active' },
  })
  const draft = sprintDto({ number: 6, status: 'draft' })

  it('padrão devolve ao backlog e explica o que fica no quadro', async () => {
    const user = userEvent.setup()
    const { api } = setup({
      sprints: [active],
      details: { [active.id]: detail(active, [todo, doing]) },
    })
    const close = vi
      .spyOn(api.sprints, 'close')
      .mockResolvedValue(detail({ ...active, status: 'closed' }))
    await ready(api)
    await goTo(user, 'Ativa')
    await user.click(await screen.findByRole('button', { name: sprintCopy.close }))
    const dialog = screen.getByRole('dialog', { name: sprintCopy.closeTitle })
    expect(within(dialog).getByText(sprintCopy.closeTileItems)).toBeTruthy()
    expect(within(dialog).getByText(sprintCopy.policyReturnHelp)).toBeTruthy()
    expect(
      within(dialog).getByRole<HTMLSelectElement>('combobox', {
        name: sprintCopy.closeDestination,
      }).value,
    ).toBe('return_to_backlog')
    await user.click(within(dialog).getByRole('button', { name: sprintCopy.closeConfirm }))
    await waitFor(() =>
      expect(close).toHaveBeenCalledWith({ sprintId: active.id, policy: 'return_to_backlog' }),
    )
  })

  it('levar para a próxima exige rascunho do projeto e envia o id escolhido', async () => {
    const user = userEvent.setup()
    const { api } = setup({
      sprints: [active, draft],
      details: { [active.id]: detail(active, [todo, doing]) },
    })
    const close = vi
      .spyOn(api.sprints, 'close')
      .mockResolvedValue(detail({ ...active, status: 'closed' }))
    await ready(api)
    await goTo(user, 'Ativa')
    await user.click(await screen.findByRole('button', { name: sprintCopy.close }))
    const dialog = screen.getByRole('dialog', { name: sprintCopy.closeTitle })
    const destination = within(dialog).getByRole('combobox', { name: sprintCopy.closeDestination })
    await user.selectOptions(
      destination,
      within(dialog).getByRole('option', { name: /Levar para a próxima sprint/ }),
    )
    expect(within(dialog).getByText(sprintCopy.policyCarryHelp)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: sprintCopy.closeConfirm }))
    await waitFor(() =>
      expect(close).toHaveBeenCalledWith({
        sprintId: active.id,
        policy: 'carry_over',
        nextSprintId: draft.id,
      }),
    )
  })

  it('sem rascunho, a opção de levar fica desabilitada', async () => {
    const user = userEvent.setup()
    const { api } = setup({
      sprints: [active],
      details: { [active.id]: detail(active, [todo]) },
    })
    await ready(api)
    await goTo(user, 'Ativa')
    await user.click(await screen.findByRole('button', { name: sprintCopy.close }))
    const dialog = screen.getByRole('dialog', { name: sprintCopy.closeTitle })
    expect(within(dialog).queryByRole('option', { name: /Levar para a próxima sprint/ })).toBeNull()
    expect(within(dialog).getByText(sprintCopy.noDraftForCarry)).toBeTruthy()
  })
})

describe('Encerradas e replanejar', () => {
  const closed = sprintDto({
    number: 3,
    status: 'closed',
    plannedStart: '2026-10-19',
    plannedEnd: '2026-11-01',
    closedAt: '2026-11-02T18:00:00.000Z',
  })
  const history: SprintDetailDto['history'] = [
    {
      taskId: taskId(30),
      taskKey: 'AB-30',
      taskTitle: 'Terminou',
      addedAt: '2026-10-20T09:00:00.000Z',
      addedBy: MANAGER_ID,
      removedAt: '2026-11-02T18:00:00.000Z',
      removedBy: MANAGER_ID,
      outcome: 'completed',
    },
    {
      taskId: taskId(31),
      taskKey: 'AB-31',
      taskTitle: 'Voltou',
      addedAt: '2026-10-20T09:00:00.000Z',
      addedBy: MANAGER_ID,
      removedAt: '2026-11-02T18:00:00.000Z',
      removedBy: MANAGER_ID,
      outcome: 'returned_to_backlog',
    },
    {
      taskId: taskId(32),
      taskKey: 'AB-32',
      taskTitle: 'Ficou',
      addedAt: '2026-10-20T09:00:00.000Z',
      addedBy: MANAGER_ID,
      removedAt: '2026-11-02T18:00:00.000Z',
      removedBy: MANAGER_ID,
      outcome: 'left_on_board',
    },
    {
      taskId: taskId(33),
      taskKey: 'AB-33',
      taskTitle: 'Levada',
      addedAt: '2026-10-20T09:00:00.000Z',
      addedBy: MANAGER_ID,
      removedAt: '2026-11-02T18:00:00.000Z',
      removedBy: MANAGER_ID,
      outcome: 'carried_over',
    },
    {
      taskId: taskId(34),
      taskKey: 'AB-34',
      taskTitle: 'Saiu',
      addedAt: '2026-10-20T09:00:00.000Z',
      addedBy: MANAGER_ID,
      removedAt: '2026-11-02T18:00:00.000Z',
      removedBy: MANAGER_ID,
      outcome: 'removed',
    },
  ]

  it('mostra o desfecho de cada item só para leitura', async () => {
    const user = userEvent.setup()
    const { api } = setup({
      sprints: [closed],
      details: { [closed.id]: detail(closed, [], history) },
    })
    await ready(api)
    await goTo(user, 'Encerradas')
    for (const label of [
      'Concluída',
      'Voltou ao backlog',
      'Ficou no quadro',
      'Levada para a próxima',
      'Removida',
    ]) {
      expect(await screen.findByText(label)).toBeTruthy()
    }
    expect(screen.getByText(sprintCopy.readOnly)).toBeTruthy()
  })

  it('replanejar cria rascunho com a mesma duração, começando hoje', async () => {
    const user = userEvent.setup()
    const { api } = setup({
      sprints: [closed],
      details: { [closed.id]: detail(closed, [], history) },
    })
    const create = vi
      .spyOn(api.sprints, 'create')
      .mockResolvedValue(detail(sprintDto({ number: 4 })))
    await ready(api)
    await goTo(user, 'Encerradas')
    await user.click(await screen.findByRole('button', { name: sprintCopy.replan }))
    await waitFor(() => expect(create).toHaveBeenCalled())
    const input = create.mock.calls[0]![0]
    expect(input.projectId).toBe(PROJECT_ID)
    expect(input.plannedStart).toBe(todayDateOnly())
    const days = (Date.parse(input.plannedEnd) - Date.parse(input.plannedStart)) / 86_400_000
    expect(days).toBe(13)
  })
})

describe('Módulo encerrando', () => {
  const active = sprintDto({ number: 5, status: 'active', startedAt: '2026-11-03T10:00:00.000Z' })
  const todo = task(40, 'Em aberto', {
    status: 'todo',
    sprint: { id: active.id, number: 5, name: 'Sprint 5', status: 'active' },
  })

  it('some com criar, iniciar, adicionar e levar, e mantém remover e encerrar', async () => {
    const user = userEvent.setup()
    const draft = sprintDto({ number: 6, status: 'draft' })
    const { api } = setup({
      winding: true,
      sprints: [active, draft],
      details: { [active.id]: detail(active, [todo]), [draft.id]: detail(draft) },
      backlog: [task(41, 'Do backlog', { inBacklog: true })],
    })
    await ready(api)
    expect(screen.queryByRole('button', { name: sprintCopy.newSprint })).toBeNull()
    await goTo(user, 'Ativa')
    expect(screen.queryByRole('region', { name: sprintCopy.backlogPick })).toBeNull()
    expect(screen.getByRole('button', { name: sprintCopy.removeItem('Em aberto') })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: sprintCopy.close }))
    const dialog = screen.getByRole('dialog', { name: sprintCopy.closeTitle })
    expect(within(dialog).queryByRole('option', { name: /Levar para a próxima sprint/ })).toBeNull()
    expect(within(dialog).getByText(sprintCopy.windingDownNoCreate)).toBeTruthy()
  })

  it('em rascunho, sem o botão de iniciar', async () => {
    const draft = sprintDto({ number: 6, status: 'draft' })
    const { api } = setup({
      winding: true,
      sprints: [draft],
      details: { [draft.id]: detail(draft) },
    })
    await ready(api)
    await screen.findByRole('heading', { name: sprintCopy.planningTitle('Sprint 6') })
    expect(screen.queryByRole('button', { name: sprintCopy.start })).toBeNull()
    expect(screen.queryByRole('region', { name: sprintCopy.backlogPick })).toBeNull()
  })
})

describe('Ativa: cerimônias na Agenda (gestor, com Agenda e Cerimônias ligadas)', () => {
  const active = sprintDto({
    number: 5,
    status: 'active',
    startedAt: '2026-11-03T10:00:00.000Z',
    plannedStart: '2026-11-02',
    plannedEnd: '2026-11-15',
  })
  const ceremonyModules: ModuleId[] = [...SCRUM, 'reviewRetro']
  const CEREMONIES = 'Cerimônias'

  const meetingFor = (title: string): MeetingDto => ({
    id: '01J8Y4G2XK8Z1S6M3Q9W0MEET1',
    title,
    date: '2026-11-02',
    time: '09:00',
    endTime: null,
    kind: 'meeting',
    recurrence: 'none',
    recurrenceUntil: null,
    participants: [],
    createdBy: MANAGER_ID,
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
  })

  it('o gestor agenda planning com título, data de início e tipo sugeridos', async () => {
    const user = userEvent.setup()
    const { api } = setup({
      modules: ceremonyModules,
      sprints: [active],
      details: { [active.id]: detail(active) },
    })
    const create = vi
      .spyOn(api.meetings, 'create')
      .mockResolvedValue(meetingFor('Planning da Sprint 5'))
    await ready(api)
    await goTo(user, 'Ativa')
    const section = await screen.findByRole('region', { name: CEREMONIES })
    await user.click(within(section).getByRole('button', { name: 'Agendar planning' }))
    expect(create).toHaveBeenCalledWith({
      title: 'Planning da Sprint 5',
      date: '2026-11-02',
      time: '09:00',
      kind: 'meeting',
      participants: [],
    })
    expect(await screen.findByText(`Planning da Sprint 5 agendada na Agenda.`)).toBeTruthy()
    const done = within(section).getByRole<HTMLButtonElement>('button', {
      name: 'Planning agendada',
    })
    expect(done.disabled).toBe(true)
  })

  it('review e retro usam o fim da sprint e os tipos de agendamento próprios', async () => {
    const user = userEvent.setup()
    const { api } = setup({
      modules: ceremonyModules,
      sprints: [active],
      details: { [active.id]: detail(active) },
    })
    const create = vi
      .spyOn(api.meetings, 'create')
      .mockResolvedValue(meetingFor('Review da Sprint 5'))
    await ready(api)
    await goTo(user, 'Ativa')
    const section = await screen.findByRole('region', { name: CEREMONIES })
    await user.click(within(section).getByRole('button', { name: 'Agendar review' }))
    await user.click(within(section).getByRole('button', { name: 'Agendar retro' }))
    expect(create).toHaveBeenNthCalledWith(1, {
      title: 'Review da Sprint 5',
      date: '2026-11-15',
      time: '10:00',
      kind: 'review',
      participants: [],
    })
    expect(create).toHaveBeenNthCalledWith(2, {
      title: 'Retrospectiva da Sprint 5',
      date: '2026-11-15',
      time: '11:00',
      kind: 'retro',
      participants: [],
    })
  })

  it('mostra a recusa do servidor no próprio bloco, sem perder os botões', async () => {
    const user = userEvent.setup()
    const { api } = setup({
      modules: ceremonyModules,
      sprints: [active],
      details: { [active.id]: detail(active) },
    })
    vi.spyOn(api.meetings, 'create').mockRejectedValue(
      new ApiError('VALIDATION', 'Horário indisponível'),
    )
    await ready(api)
    await goTo(user, 'Ativa')
    const section = await screen.findByRole('region', { name: CEREMONIES })
    await user.click(within(section).getByRole('button', { name: 'Agendar planning' }))
    expect(await within(section).findByRole('alert')).toBeTruthy()
    expect(within(section).getByText('Horário indisponível')).toBeTruthy()
    expect(
      within(section).getByRole<HTMLButtonElement>('button', { name: 'Agendar planning' }).disabled,
    ).toBe(false)
  })

  it('some quando a ferramenta de cerimônias está desligada', async () => {
    const user = userEvent.setup()
    const { api } = setup({
      modules: [...SCRUM],
      sprints: [active],
      details: { [active.id]: detail(active) },
    })
    await ready(api)
    await goTo(user, 'Ativa')
    await screen.findByRole('group', { name: sprintCopy.tabsLabel })
    expect(await screen.findByRole('button', { name: sprintCopy.close })).toBeTruthy()
    expect(screen.queryByRole('region', { name: CEREMONIES })).toBeNull()
  })

  it('some quando a Agenda está desligada, mesmo com cerimônias ligadas', async () => {
    const user = userEvent.setup()
    const { api } = setup({
      modules: ceremonyModules.filter((id) => id !== 'agenda'),
      sprints: [active],
      details: { [active.id]: detail(active) },
    })
    await ready(api)
    await goTo(user, 'Ativa')
    expect(await screen.findByRole('button', { name: sprintCopy.close })).toBeTruthy()
    expect(screen.queryByRole('region', { name: CEREMONIES })).toBeNull()
  })

  it('o colaborador não vê o bloco, nem com as ferramentas ligadas', async () => {
    const user = userEvent.setup()
    const { api } = setup({
      manager: false,
      modules: ceremonyModules,
      sprints: [active],
      details: { [active.id]: detail(active) },
      // Colaborador só vê projeto de que participa: MANAGER_ID é o id logado.
      members: [{ id: MANAGER_ID }],
    })
    await ready(api)
    await goTo(user, 'Ativa')
    expect(await screen.findByRole('button', { name: sprintCopy.close })).toBeTruthy()
    expect(screen.queryByRole('region', { name: CEREMONIES })).toBeNull()
  })
})

/** Burndown de uma sprint ativa: 11 dias (10/11 a 20/11), hoje é o dia 17/11 (dia 8). */
function activeBurndown(
  sprintNumber: number,
  remaining: readonly number[],
  velocity: BurndownViewDto['velocity'] = { average: null, sprints: [] },
): BurndownViewDto {
  return {
    projectId: PROJECT_ID,
    today: '2026-11-17',
    sprint: {
      id: sprintId(sprintNumber),
      number: sprintNumber,
      name: `Sprint ${sprintNumber}`,
      status: 'active',
      plannedStart: '2026-11-10',
      plannedEnd: '2026-11-20',
    },
    totalHours: 28,
    remainingHours: 18,
    scopeTasks: 5,
    doneTasks: 1,
    unestimatedTasks: 1,
    days: Array.from({ length: 11 }, (_, index) => ({
      date: `2026-11-${String(10 + index).padStart(2, '0')}`,
      idealHours: Math.round((28 - 2.8 * index) * 10) / 10,
      remainingHours: index < remaining.length ? remaining[index]! : null,
    })),
    velocity,
  }
}

describe('Planejamento no layout do design (tela 07)', () => {
  it('mostra título, etiqueta, período com dia da semana, dias úteis e a meta', async () => {
    const draft = sprintDto({
      number: 5,
      goal: 'Acompanhar o chamado em tempo real',
      plannedStart: '2026-11-24',
      plannedEnd: '2026-12-05',
    })
    const { api } = setup({ sprints: [draft], details: { [draft.id]: detail(draft) } })
    await ready(api)
    expect(await screen.findByRole('heading', { name: 'Planejar Sprint 5' })).toBeTruthy()
    expect(screen.getByText('Rascunho')).toBeTruthy()
    expect(screen.getByText('ter 24/11 → sáb 05/12')).toBeTruthy()
    expect(screen.getByText('9 dias úteis')).toBeTruthy()
    expect(screen.getByText('Acompanhar o chamado em tempo real')).toBeTruthy()
  })

  it('o backlog mostra a ordem, as estimativas e quantos itens não têm estimativa', async () => {
    const draft = sprintDto({ number: 5 })
    const { api } = setup({
      sprints: [draft],
      details: { [draft.id]: detail(draft) },
      backlog: [
        task(1, 'Notificar mudança de status', { estimatedHours: 6, inBacklog: true }),
        task(2, 'Avaliar o atendimento', { estimatedHours: null, inBacklog: true }),
      ],
    })
    await ready(api)
    expect(await screen.findByText(sprintCopy.backlogOrder(2))).toBeTruthy()
    expect(screen.getByText(sprintCopy.noEstimateCount(1))).toBeTruthy()
    expect(screen.getByText('6 h')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('arrastar um item do backlog até a coluna da sprint leva o item, como o +', async () => {
    const draft = sprintDto({ number: 5 })
    const backlogItem = task(2, 'Trocar ícone', { inBacklog: true, estimatedHours: 3 })
    const { api } = setup({
      sprints: [draft],
      details: { [draft.id]: detail(draft) },
      backlog: [backlogItem],
    })
    const add = vi
      .spyOn(api.sprints, 'addTask')
      .mockResolvedValue(detail(draft, [{ ...backlogItem, sprint: null }]))
    await ready(api)
    const row = (await screen.findByText('Trocar ícone')).closest('li')!
    const column = screen.getByRole('region', {
      name: `${sprintCopy.items}`.replace(/^/, 'Sprint 5 · '),
    })
    fireEvent.dragStart(row, { dataTransfer: { setData: vi.fn(), getData: () => backlogItem.id } })
    fireEvent.dragOver(column, { dataTransfer: { getData: () => backlogItem.id } })
    fireEvent.drop(column, { dataTransfer: { getData: () => backlogItem.id } })
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ sprintId: draft.id, taskId: backlogItem.id }),
    )
  })

  it('a estimativa da sprint aparece junto da velocidade média das sprints encerradas', async () => {
    const draft = sprintDto({ number: 5 })
    const items = [
      task(1, 'Acompanhar status', {
        sprint: { id: draft.id, number: 5, name: 'Sprint 5', status: 'draft' },
        estimatedHours: 40,
      }),
      task(2, 'Aviso do técnico', {
        sprint: { id: draft.id, number: 5, name: 'Sprint 5', status: 'draft' },
        estimatedHours: 22,
      }),
    ]
    const velocity = {
      average: 57,
      sprints: [1, 2, 3].map((number) => ({
        sprintId: sprintId(number),
        number,
        name: `Sprint ${number}`,
        hours: 57,
      })),
    }
    const { api } = setup({
      sprints: [draft],
      details: { [draft.id]: detail(draft, items) },
      modules: [...SCRUM, 'burndown'],
      burndown: { ...activeBurndown(4, []), sprint: null, velocity },
    })
    await ready(api)
    expect(await screen.findByText(sprintCopy.estimatedTitle)).toBeTruthy()
    expect(screen.getAllByText('62 h').length).toBeGreaterThan(0)
    expect(screen.getByText('Média de 3 sprints encerradas: 57 h.')).toBeTruthy()
  })
})

describe('Sprint ativa no layout do design (tela 08)', () => {
  const active = sprintDto({
    number: 4,
    status: 'active',
    goal: 'Abrir chamado pelo app em até 3 toques',
    plannedStart: '2026-11-10',
    plannedEnd: '2026-11-20',
    startedAt: '2026-11-10T09:00:00.000Z',
  })
  const sprintRef = { id: active.id, number: 4, name: 'Sprint 4', status: 'active' as const }
  const items = [
    task(1, 'Tela de abrir chamado', { status: 'todo', estimatedHours: 8, sprint: sprintRef }),
    task(2, 'Enviar chamado pela API', {
      status: 'in_progress',
      estimatedHours: 6,
      actualHours: 2,
      sprint: sprintRef,
    }),
    task(3, 'Aviso de chamado aberto', { status: 'review', estimatedHours: 4, sprint: sprintRef }),
    task(4, 'Criar o projeto do app', { status: 'done', estimatedHours: 10, sprint: sprintRef }),
    task(5, 'Mensagem de erro amigável', { status: 'todo', sprint: sprintRef }),
  ]

  it('mostra meta, dia, restante, atraso do ideal e as colunas do design', async () => {
    const { api } = setup({
      sprints: [active],
      details: { [active.id]: detail(active, items) },
      modules: [...SCRUM, 'burndown'],
      // Restante 16 h no dia 8: a linha ideal chegou a 16 h no dia 6, então a sprint está 2 dias atrás.
      burndown: activeBurndown(4, [28, 26, 24, 22, 20, 18, 16, 16]),
    })
    await ready(api)
    await goTo(userEvent.setup(), 'Ativa')
    expect(await screen.findByText('Abrir chamado pelo app em até 3 toques')).toBeTruthy()
    expect(screen.getByText(sprintCopy.ofTotal(11))).toBeTruthy()
    expect(screen.getByText(sprintCopy.behindIdeal(2))).toBeTruthy()
    expect(screen.getByText(sprintCopy.ofTotal('28 h'))).toBeTruthy()
    for (const name of ['A fazer', 'Desenvolvendo', 'Revisar', 'Concluído']) {
      expect(screen.getByRole('region', { name })).toBeTruthy()
    }
    expect(screen.queryByRole('region', { name: 'Planejamento' })).toBeNull()
  })

  it('cartões mostram horas restantes, em revisão e sem estimativa', async () => {
    const { api } = setup({
      sprints: [active],
      details: { [active.id]: detail(active, items) },
    })
    await ready(api)
    await goTo(userEvent.setup(), 'Ativa')
    const doing = await screen.findByRole('region', { name: 'Desenvolvendo' })
    expect(within(doing).getByText(sprintCopy.cardRemaining('4 h'))).toBeTruthy()
    expect(
      within(screen.getByRole('region', { name: 'Revisar' })).getByText(sprintCopy.cardInReview),
    ).toBeTruthy()
    expect(
      within(screen.getByRole('region', { name: 'A fazer' })).getByText(sprintCopy.noEstimate),
    ).toBeTruthy()
    expect(
      within(screen.getByRole('region', { name: 'Concluído' })).getByText('Criar o projeto do app'),
    ).toBeTruthy()
  })

  it('Nova tarefa e Abrir burndown chamam as ações da tela', async () => {
    const onNewTask = vi.fn()
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    const { api } = setup({
      sprints: [active],
      details: { [active.id]: detail(active, items) },
      modules: [...SCRUM, 'burndown'],
      burndown: activeBurndown(4, [28, 26, 24, 22, 20, 18, 16, 16]),
      onNewTask,
      onNavigate,
    })
    await ready(api)
    await goTo(user, 'Ativa')
    await user.click(await screen.findByRole('button', { name: sprintCopy.newTask }))
    expect(onNewTask).toHaveBeenCalledTimes(1)
    // O nome acessível traz o atraso ("Abrir burndown: 2 dias atrás do ideal").
    await user.click(screen.getByRole('button', { name: /^Abrir burndown/ }))
    expect(onNavigate).toHaveBeenCalledWith('burndown')
  })

  it('o planejamento só ganha coluna própria quando há item nesse estado', async () => {
    const planning = task(6, 'Ideia para depois', { status: 'planning', sprint: sprintRef })
    const { api } = setup({
      sprints: [active],
      details: { [active.id]: detail(active, [...items, planning]) },
    })
    await ready(api)
    await goTo(userEvent.setup(), 'Ativa')
    expect(await screen.findByRole('region', { name: 'Planejamento' })).toBeTruthy()
  })
})
