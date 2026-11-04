import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TASK_STATUSES, TASK_STATUS_LABELS } from '@agilebox/core'
import { ApiError } from '@agilebox/contract'
import type {
  DefinitionOfDoneItemDto,
  DashboardDto,
  ListBoardDto,
  ProjectDto,
  SessionUserDto,
  TaskDto,
} from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import { App } from './App'
import { makeDetail, makeEvent } from './task-detail/fixtures'

afterEach(cleanup)

const ORG = '01J8Y4G2XK8Z1S6M3Q9W0A5G01'
const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const ANA = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'
const BRUNO = '01J8Y4G2XK8Z1S6M3Q9W0A5V03'
const AURORA = '01J8Y4G2XK8Z1S6M3Q9W0A5BC1'
const BOREAL = '01J8Y4G2XK8Z1S6M3Q9W0A5BC2'
const ITEM_TESTS = '01J8Y4G2XK8Z1S6M3Q9W0A5DF1'
const ITEM_REVIEW = '01J8Y4G2XK8Z1S6M3Q9W0A5DF2'
const ITEM_NEW = '01J8Y4G2XK8Z1S6M3Q9W0A5DF3'

const users: SessionUserDto[] = [
  { id: MANAGER, name: 'Marta Gestora', initials: 'MG', role: 'manager', defaultRate: 80 },
  { id: ANA, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: null },
  { id: BRUNO, name: 'Bruno Lima', initials: 'BL', role: 'collaborator', defaultRate: null },
]

function project(overrides: Partial<ProjectDto>): ProjectDto {
  return {
    id: AURORA,
    name: 'Projeto Aurora',
    createdBy: ANA,
    createdAt: '2026-10-31T12:00:00.000Z',
    definitionOfDoneCount: 0,
    ...overrides,
  }
}

function item(id: string, title: string, position: number, projectId = AURORA) {
  return { id, projectId, title, position } satisfies DefinitionOfDoneItemDto
}

const TWO_ITEMS = [item(ITEM_TESTS, 'Testes passando', 0), item(ITEM_REVIEW, 'Revisado por par', 1)]

const reviewTask: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
  number: 118,
  key: 'AB-118',
  projectId: AURORA,
  projectName: 'Projeto Aurora',
  title: 'Revisar integração',
  description: '',
  status: 'review',
  priority: 'normal',
  blockedReason: null,
  blockedAt: null,
  checklistProgress: { done: 0, total: 0, percent: 0 },
  commentCount: 0,
  deadline: null,
  ticketId: null,
  ticketUrl: null,
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
}

const emptyTask: TaskDto = {
  ...reviewTask,
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCE',
  number: 119,
  key: 'AB-119',
  projectId: BOREAL,
  projectName: 'Projeto Boreal',
  title: 'Publicar versão',
}

const dashboard: DashboardDto = {
  insights: {
    updatedAt: '2026-11-01T12:00:00Z',
    weekStart: '2026-10-26',
    upToDatePercentage: 75,
    agingCount: 0,
    overdueCount: 0,
    blockedCount: 0,
    overWipColumns: [],
    cycleDays: 3,
    leadDays: 5,
    throughput: 2,
    weeks: [],
    recentChanges: [],
    team: [],
  },
  distribution: { planning: 0, todo: 0, in_progress: 0, review: 1, done: 0 },
  collaborators: [],
}

interface SetupOptions {
  readonly tasks?: TaskDto[]
  readonly projects?: ProjectDto[]
  readonly definition?: Record<string, DefinitionOfDoneItemDto[]>
}

function setup(currentUserId: string, options: SetupOptions = {}) {
  const tasks = options.tasks ?? [reviewTask]
  const projects = options.projects ?? [
    project({ definitionOfDoneCount: 2 }),
    project({ id: BOREAL, name: 'Projeto Boreal', createdBy: BRUNO }),
  ]
  const definition = options.definition ?? { [AURORA]: TWO_ITEMS, [BOREAL]: [] }
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: currentUserId,
    organizationId: ORG,
    role: currentUserId === MANAGER ? 'manager' : 'collaborator',
  })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue(users)
  vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
  vi.spyOn(api.projects, 'listMembers').mockResolvedValue([])
  vi.spyOn(api.tasks, 'listBoard').mockResolvedValue({
    tasks,
    wipLimits: {},
    wipColumns: [],
  } satisfies ListBoardDto)
  vi.spyOn(api.dashboard, 'get').mockResolvedValue(dashboard)
  vi.spyOn(api.tasks, 'getBoardFlow').mockResolvedValue({
    cycleDays: 3,
    weekStart: '2026-10-26',
    updatedAt: '2026-11-01T12:00:00.000Z',
  })
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  vi.spyOn(api.contributors, 'list').mockResolvedValue([])
  vi.spyOn(api.projects.definitionOfDone, 'list').mockImplementation(({ projectId }) =>
    Promise.resolve(definition[projectId] ?? []),
  )
  vi.spyOn(api.tasks, 'get').mockImplementation(({ taskId }) => {
    const task = tasks.find((candidate) => candidate.id === taskId) ?? reviewTask
    return Promise.resolve(
      makeDetail({
        id: task.id,
        title: task.title,
        status: task.status,
        projectId: task.projectId,
        projectName: task.projectName,
        projectDefinitionOfDone: definition[task.projectId] ?? [],
      }),
    )
  })
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, user: userEvent.setup() }
}

function selectDone(user: ReturnType<typeof userEvent.setup>, title: string) {
  return screen
    .findByRole('combobox', { name: `Mover ${title} para outro estado` })
    .then((select) => user.selectOptions(select, 'done'))
}

describe('Conferência da definição de pronto ao concluir pelo quadro', () => {
  it('abre a conferência, só habilita Concluir com todos marcados e envia os ids', async () => {
    const { api, user } = setup(ANA)
    const move = vi.spyOn(api.tasks, 'move').mockResolvedValue({ ...reviewTask, status: 'done' })

    await selectDone(user, reviewTask.title)
    const dialog = await screen.findByRole('dialog', { name: 'Definição de pronto' })
    expect(within(dialog).getByText('Confirme cada item para concluir esta tarefa.')).toBeTruthy()
    const confirm = within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Concluir' })
    expect(confirm.disabled).toBe(true)

    await user.click(within(dialog).getByRole('checkbox', { name: 'Testes passando' }))
    expect(confirm.disabled).toBe(true)
    await user.click(within(dialog).getByRole('checkbox', { name: 'Revisado por par' }))
    expect(confirm.disabled).toBe(false)

    await user.click(confirm)
    await waitFor(() =>
      expect(move).toHaveBeenCalledWith({
        taskId: reviewTask.id,
        status: 'done',
        confirmedDefinitionItemIds: [ITEM_TESTS, ITEM_REVIEW],
      }),
    )
    expect(screen.queryByRole('dialog', { name: 'Definição de pronto' })).toBeNull()
  })

  it('cancelar não muda a tarefa, não chama a API e não mostra erro', async () => {
    const { api, user } = setup(ANA)
    const move = vi.spyOn(api.tasks, 'move')

    await selectDone(user, reviewTask.title)
    await screen.findByRole('dialog', { name: 'Definição de pronto' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Definição de pronto' })).toBeNull()
    expect(move).not.toHaveBeenCalled()
    const review = screen.getByRole('region', { name: 'Revisar, tarefas' })
    expect(
      within(review).getByRole('button', { name: `${reviewTask.key} · ${reviewTask.title}` }),
    ).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('projeto sem itens conclui direto, sem conferência', async () => {
    const { api, user } = setup(ANA, {
      tasks: [emptyTask],
      projects: [project({ id: BOREAL, name: 'Projeto Boreal', createdBy: BRUNO })],
    })
    const move = vi.spyOn(api.tasks, 'move').mockResolvedValue({ ...emptyTask, status: 'done' })

    await selectDone(user, emptyTask.title)

    await waitFor(() => expect(move).toHaveBeenCalledWith({ taskId: emptyTask.id, status: 'done' }))
    expect(screen.queryByRole('dialog', { name: 'Definição de pronto' })).toBeNull()
  })

  it('conferência recusada pelo servidor reabre o diálogo com os itens atuais', async () => {
    // O cache dizia "sem itens", mas um item novo foi criado no meio tempo.
    const { api, user } = setup(ANA, {
      projects: [project({ definitionOfDoneCount: 0 })],
      definition: { [AURORA]: [] },
    })
    const move = vi
      .spyOn(api.tasks, 'move')
      .mockRejectedValueOnce(
        new ApiError('DEFINITION_OF_DONE_NOT_CONFIRMED', 'Confirme a definição de pronto', [
          { id: ITEM_TESTS, title: 'Testes passando' },
        ]),
      )
      .mockResolvedValueOnce({ ...reviewTask, status: 'done' })
    vi.spyOn(api.projects.definitionOfDone, 'list').mockResolvedValue([
      item(ITEM_TESTS, 'Testes passando', 0),
      item(ITEM_REVIEW, 'Revisado por par', 1),
      item(ITEM_NEW, 'Documentação atualizada', 2),
    ])

    await selectDone(user, reviewTask.title)
    const dialog = await screen.findByRole('dialog', { name: 'Definição de pronto' })
    expect(within(dialog).getByText(/A definição de pronto mudou/)).toBeTruthy()
    expect(within(dialog).getByRole('checkbox', { name: 'Documentação atualizada' })).toBeTruthy()

    for (const name of ['Testes passando', 'Revisado por par', 'Documentação atualizada']) {
      await user.click(within(dialog).getByRole('checkbox', { name }))
    }
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }))

    await waitFor(() => expect(move).toHaveBeenCalledTimes(2))
    expect(move).toHaveBeenNthCalledWith(1, { taskId: reviewTask.id, status: 'done' })
    expect(move).toHaveBeenNthCalledWith(2, {
      taskId: reviewTask.id,
      status: 'done',
      confirmedDefinitionItemIds: [ITEM_TESTS, ITEM_REVIEW, ITEM_NEW],
    })
  })
})

/**
 * jsdom não tem layout: dá a cada coluna e card uma caixa, para o arraste pelo teclado do dnd-kit
 * achar a coluna de destino (Planejamento, A fazer, Desenvolvendo, Revisar, Concluído, nessa ordem).
 */
function stubBoardGeometry() {
  const box = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    // O DragOverlay (posição fixa, com a caixa no estilo inline) é medido pelo próprio estilo.
    const overlay = this.closest<HTMLElement>('[style*="position: fixed"]')
    if (overlay && overlay.style.width) {
      return box(
        parseFloat(overlay.style.left) || 0,
        parseFloat(overlay.style.top) || 0,
        parseFloat(overlay.style.width),
        parseFloat(overlay.style.height) || 0,
      )
    }
    const column = this.closest<HTMLElement>('section[aria-label$=", tarefas"]')
    if (!column) return box(0, 0, 0, 0)
    const label = column.getAttribute('aria-label') ?? ''
    const index = TASK_STATUSES.findIndex((status) => label.startsWith(TASK_STATUS_LABELS[status]))
    const columnLeft = Math.max(index, 0) * 300
    const card = this.closest<HTMLElement>('[data-task-id]')
    if (card) return box(columnLeft + 8, 80, 264, 80)
    return box(columnLeft, 0, 280, 900)
  })
}

describe('Conferência ao arrastar o card para Concluído', () => {
  it('cancelar a conferência no arraste deixa o card na coluna de origem', async () => {
    const { api, user } = setup(ANA)
    const move = vi.spyOn(api.tasks, 'move')
    stubBoardGeometry()

    const handle = await screen.findByRole('button', { name: `Mover ${reviewTask.title}` })
    handle.focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowRight}')
    await user.keyboard(' ')
    await screen.findByRole('dialog', { name: 'Definição de pronto' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Definição de pronto' })).toBeNull()
    expect(move).not.toHaveBeenCalled()
    const review = screen.getByRole('region', { name: 'Revisar, tarefas' })
    expect(
      within(review).getByRole('button', { name: `${reviewTask.key} · ${reviewTask.title}` }),
    ).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('arrastar pelo teclado até Concluído abre a conferência e só move com a confirmação', async () => {
    const { api, user } = setup(ANA)
    const move = vi.spyOn(api.tasks, 'move').mockResolvedValue({ ...reviewTask, status: 'done' })
    stubBoardGeometry()

    const handle = await screen.findByRole('button', { name: `Mover ${reviewTask.title}` })
    handle.focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowRight}')
    await user.keyboard(' ')

    const dialog = await screen.findByRole('dialog', { name: 'Definição de pronto' })
    expect(move).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Testes passando' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Revisado por par' }))
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }))

    await waitFor(() =>
      expect(move).toHaveBeenCalledWith({
        taskId: reviewTask.id,
        status: 'done',
        confirmedDefinitionItemIds: [ITEM_TESTS, ITEM_REVIEW],
      }),
    )
  })
})

describe('Conferência ao concluir pelo detalhe e pela criação', () => {
  it('a troca de estado no detalhe passa pela conferência', async () => {
    const { api, user } = setup(ANA)
    const move = vi.spyOn(api.tasks, 'move').mockResolvedValue({ ...reviewTask, status: 'done' })

    await user.click(await screen.findByRole('button', { name: 'AB-118 · Revisar integração' }))
    await user.click(await screen.findByRole('button', { name: 'Status' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Concluído' }))

    const dialog = await screen.findByRole('dialog', { name: 'Definição de pronto' })
    expect(move).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Testes passando' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Revisado por par' }))
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }))

    await waitFor(() =>
      expect(move).toHaveBeenCalledWith({
        taskId: reviewTask.id,
        status: 'done',
        confirmedDefinitionItemIds: [ITEM_TESTS, ITEM_REVIEW],
      }),
    )
  })

  it('criar já como Concluído pede a conferência antes de criar', async () => {
    const { api, user } = setup(ANA)
    const created = { ...reviewTask, id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCF', status: 'done' as const }
    const create = vi.spyOn(api.tasks, 'create').mockResolvedValue(created)

    await user.click(await screen.findByRole('button', { name: 'Nova tarefa em Concluído' }))
    const newTask = await screen.findByRole('dialog', { name: 'Nova tarefa' })
    await user.type(within(newTask).getByLabelText('Título'), 'Entregar relatório')
    await user.click(within(newTask).getByRole('button', { name: 'Criar tarefa' }))

    const dialog = await screen.findByRole('dialog', { name: 'Definição de pronto' })
    expect(create).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Testes passando' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Revisado por par' }))
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }))

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        projectId: AURORA,
        title: 'Entregar relatório',
        status: 'done',
        confirmedDefinitionItemIds: [ITEM_TESTS, ITEM_REVIEW],
      }),
    )
  })

  it('o evento de conferência aparece na linha do tempo com a frase do servidor', async () => {
    const { api, user } = setup(ANA)
    vi.spyOn(api.timeline, 'list').mockResolvedValue([
      makeEvent({
        type: 'definition_confirmed',
        text: 'concluiu a tarefa confirmando a definição de pronto (2 itens)',
      }),
    ])

    await user.click(await screen.findByRole('button', { name: 'AB-118 · Revisar integração' }))

    expect(
      await screen.findByText('concluiu a tarefa confirmando a definição de pronto (2 itens)'),
    ).toBeTruthy()
  })
})

describe('Edição da definição de pronto no diálogo do projeto', () => {
  async function openProject(user: ReturnType<typeof userEvent.setup>, projectName: string) {
    await user.click(
      await screen.findByRole('button', { name: /Projeto atual: Todos os projetos/ }),
    )
    await user.click(screen.getByRole('option', { name: projectName }))
    await user.click(
      await screen.findByRole('button', { name: new RegExp(`Projeto atual: ${projectName}`) }),
    )
  }

  it('gestor adiciona com Enter, renomeia, move, remove e vê o limite de 20', async () => {
    const { api, user } = setup(MANAGER, { definition: { [BOREAL]: [] } })
    const add = vi
      .spyOn(api.projects.definitionOfDone, 'add')
      .mockResolvedValue([item(ITEM_TESTS, 'Testes passando', 0, BOREAL)])
    await openProject(user, 'Projeto Boreal')

    expect(await screen.findByText('Nenhum item. A tarefa conclui sem conferência.')).toBeTruthy()
    const field = screen.getByRole('textbox', { name: 'Novo item da definição de pronto' })
    await user.type(field, 'Testes passando{Enter}')
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ projectId: BOREAL, title: 'Testes passando' }),
    )
    expect(await screen.findByText('Testes passando')).toBeTruthy()
  })

  it('renomear: vazio e 201 caracteres mostram erro e não gravam; 200 grava', async () => {
    const { api, user } = setup(MANAGER, {
      definition: { [BOREAL]: [item(ITEM_TESTS, 'Testes', 0, BOREAL)] },
    })
    const rename = vi
      .spyOn(api.projects.definitionOfDone, 'rename')
      .mockResolvedValue([item(ITEM_TESTS, 'Testes passando', 0, BOREAL)])
    await openProject(user, 'Projeto Boreal')

    await user.click(await screen.findByRole('button', { name: 'Renomear Testes' }))
    const input = screen.getByRole('textbox', { name: 'Título do item' })
    await user.clear(input)
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Escreva um título para o item.')).toBeTruthy()

    await user.type(input, 'a'.repeat(201))
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Use até 200 caracteres.')).toBeTruthy()
    expect(rename).not.toHaveBeenCalled()
    await user.clear(input)
    await user.type(input, 'b'.repeat(200))
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(rename).toHaveBeenCalledWith({
        projectId: BOREAL,
        itemId: ITEM_TESTS,
        title: 'b'.repeat(200),
      }),
    )
    expect(rename).toHaveBeenCalledTimes(1)
  })

  it('Esc cancela a renomeação sem fechar o diálogo do projeto', async () => {
    const { api, user } = setup(MANAGER, {
      definition: { [BOREAL]: [item(ITEM_TESTS, 'Testes', 0, BOREAL)] },
    })
    const rename = vi.spyOn(api.projects.definitionOfDone, 'rename')
    await openProject(user, 'Projeto Boreal')
    await user.click(await screen.findByRole('button', { name: 'Renomear Testes' }))
    await user.type(screen.getByRole('textbox', { name: 'Título do item' }), ' extra{Escape}')

    expect(screen.getByRole('dialog', { name: 'Projetos' })).toBeTruthy()
    expect(screen.getByText('Testes')).toBeTruthy()
    expect(rename).not.toHaveBeenCalled()
  })

  it('move para cima e para baixo e remove pelos botões', async () => {
    const { api, user } = setup(MANAGER, {
      definition: {
        [BOREAL]: [item(ITEM_TESTS, 'Testes', 0, BOREAL), item(ITEM_REVIEW, 'Revisão', 1, BOREAL)],
      },
    })
    const move = vi
      .spyOn(api.projects.definitionOfDone, 'move')
      .mockResolvedValue([
        item(ITEM_REVIEW, 'Revisão', 0, BOREAL),
        item(ITEM_TESTS, 'Testes', 1, BOREAL),
      ])
    const remove = vi
      .spyOn(api.projects.definitionOfDone, 'remove')
      .mockResolvedValue([item(ITEM_TESTS, 'Testes', 0, BOREAL)])
    await openProject(user, 'Projeto Boreal')

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Mover Testes para cima' }).disabled,
    ).toBe(true)
    await user.click(await screen.findByRole('button', { name: 'Mover Testes para baixo' }))
    await waitFor(() =>
      expect(move).toHaveBeenCalledWith({ projectId: BOREAL, itemId: ITEM_TESTS, position: 1 }),
    )
    await user.click(screen.getByRole('button', { name: 'Remover Revisão' }))
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith({ projectId: BOREAL, itemId: ITEM_REVIEW }),
    )
  })

  it('no limite de 20 itens o campo de adicionar fica desabilitado', async () => {
    const twenty = Array.from({ length: 20 }, (_, index) =>
      item(
        `01J8Y4G2XK8Z1S6M3Q9W0A5D${String(index).padStart(3, '0')}`,
        `Item ${index + 1}`,
        index,
        BOREAL,
      ),
    )
    const { user } = setup(MANAGER, { definition: { [BOREAL]: twenty } })
    await openProject(user, 'Projeto Boreal')

    expect(await screen.findByText('Limite de 20 itens.')).toBeTruthy()
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Novo item da definição de pronto' })
        .disabled,
    ).toBe(true)
  })

  it('falha ao gravar mostra aviso curto', async () => {
    const { api, user } = setup(MANAGER, { definition: { [BOREAL]: [] } })
    vi.spyOn(api.projects.definitionOfDone, 'add').mockRejectedValue(
      new ApiError('CONFLICT', 'Ocorreu um erro inesperado'),
    )
    await openProject(user, 'Projeto Boreal')
    await user.type(
      screen.getByRole('textbox', { name: 'Novo item da definição de pronto' }),
      'Teste{Enter}',
    )

    expect(
      await screen.findByText('Não foi possível atualizar a definição de pronto.'),
    ).toBeTruthy()
  })

  it('o criador do projeto também edita; colaborador comum só lê', async () => {
    const { user } = setup(ANA, { definition: { [AURORA]: TWO_ITEMS } })
    await openProject(user, 'Projeto Aurora')
    expect(await screen.findByRole('button', { name: 'Renomear Testes passando' })).toBeTruthy()
    await user.keyboard('{Escape}')

    cleanup()
    const reader = setup(BRUNO, { definition: { [AURORA]: TWO_ITEMS } })
    await openProject(reader.user, 'Projeto Aurora')

    expect(await screen.findByText('Testes passando')).toBeTruthy()
    expect(screen.getByText(/Somente leitura: só o gestor e o criador/)).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Novo item da definição de pronto' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Renomear Testes passando' })).toBeNull()
  })
})
