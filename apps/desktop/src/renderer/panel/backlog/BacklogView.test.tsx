import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { presetModules, teamToolsView } from '../../shared/testing/team-tools-fixture'
import type { ModuleId } from '@agilebox/core'
import type { ProjectDto, TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { CapabilitiesProvider } from '../../shared/capabilities/CapabilitiesProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { settleCapabilities } from '../../shared/testing/render-panel'
import { BacklogView } from './BacklogView'

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'
const OTHER_PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDF'
const USER_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const MANAGER_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5V09'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PROJECT: ProjectDto = {
  id: PROJECT_ID,
  name: 'Projeto Aurora',
  createdBy: MANAGER_ID,
  createdAt: '2026-10-31T12:00:00.000Z',
  definitionOfDoneCount: 0,
  archivedAt: null,
}

function item(
  number: number,
  title: string,
  overrides: Partial<TaskDto> = {},
  projectId = PROJECT_ID,
): TaskDto {
  return {
    id: `01J8Y4G2XK8Z1S6M3Q9W0BK${String(number).padStart(2, '0')}`,
    number,
    key: `AB-${number}`,
    projectId,
    projectName: 'Projeto Aurora',
    title,
    description: '',
    status: 'planning',
    priority: 'normal',
    blockedReason: null,
    blockedAt: null,
    archivedAt: null,
    backlogRank: number,
    inBacklog: true,
    estimatedHours: null,
    actualHours: 0,
    deadline: null,
    ticketId: null,
    ticketUrl: null,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    checklistProgress: { done: 0, total: 0, percent: 0 },
    commentCount: 0,
    ...overrides,
  }
}

const SCRUM = presetModules('scrum')
const KANBAN = presetModules('kanban')

interface SetupOptions {
  readonly modules?: readonly ModuleId[]
  readonly level?: 'basic' | 'intermediate' | 'advanced'
  readonly winding?: readonly ModuleId[]
  readonly role?: 'collaborator' | 'manager'
  readonly items?: readonly TaskDto[] | (() => Promise<TaskDto[]>)
  readonly projects?: readonly ProjectDto[]
  readonly members?: Record<string, readonly string[]>
  /** Guia indisponível: o estado vazio cai nos textos antigos (fallback). */
  readonly guideFails?: boolean
}

function setup({
  modules = SCRUM,
  level = 'intermediate',
  winding = [],
  role = 'manager',
  items = [item(1, 'Revisar integração'), item(2, 'Ajustar relatório'), item(3, 'Trocar ícone')],
  projects = [PROJECT],
  members = {},
  guideFails = false,
}: SetupOptions = {}) {
  const api = createFakeApi()
  if (guideFails) vi.spyOn(api.guide, 'get').mockRejectedValue(new Error('guia indisponível'))
  vi.spyOn(api.teamTools, 'get').mockResolvedValue(
    teamToolsView({ modules: [...modules], level, role, winding: [...winding] }),
  )
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: role === 'manager' ? MANAGER_ID : USER_ID,
    organizationId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDG',
    role,
  })
  vi.spyOn(api.projects, 'listMembers').mockImplementation(({ projectId }) =>
    Promise.resolve(
      (members[projectId] ?? []).map((id) => ({
        id,
        name: id === USER_ID ? 'Ana Souza' : 'Outra pessoa',
        initials: 'AS',
        role: 'collaborator' as const,
      })),
    ),
  )
  const list =
    typeof items === 'function'
      ? vi.spyOn(api.backlog, 'list').mockImplementation(() => items())
      : vi.spyOn(api.backlog, 'list').mockImplementation(() => Promise.resolve([...items]))
  const reorder = vi
    .spyOn(api.backlog, 'reorder')
    .mockImplementation((input) => Promise.resolve(item(0, 'movido', { id: input.taskId })))
  const add = vi
    .spyOn(api.backlog, 'add')
    .mockImplementation((input) =>
      Promise.resolve(item(9, input.title, { id: '01J8Y4G2XK8Z1S6M3Q9W0BK99' })),
    )
  const pull = vi
    .spyOn(api.backlog, 'pull')
    .mockImplementation((input) => Promise.resolve(item(0, 'puxado', { id: input.taskId })))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <CapabilitiesProvider>
          <BacklogView
            initialProjectId={PROJECT_ID}
            projects={projects}
            isManager={role === 'manager'}
          />
        </CapabilitiesProvider>
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { api, list, reorder, add, pull }
}

const rowOf = (title: string) =>
  screen.getByRole('button', { name: `Abrir ${title}` }).closest('li') as HTMLElement

describe('Backlog: lista e criação rápida', () => {
  it('mostra os itens na ordem do backlog, com número AB-n e o nome da tela', async () => {
    setup()
    const list = await screen.findByRole('list', { name: 'Itens do backlog' })
    const titles = within(list)
      .getAllByRole('button', { name: /^Abrir / })
      .map((button) => button.textContent)
    expect(titles).toEqual(['Revisar integração', 'Ajustar relatório', 'Trocar ícone'])
    expect(within(rowOf('Revisar integração')).getByText('AB-1')).toBeTruthy()
  })

  it('Enter no campo "Adicionar ao backlog" cria o item pelo backlog.add', async () => {
    const user = userEvent.setup()
    const s = setup()
    const field = await screen.findByRole('textbox', { name: 'Adicionar ao backlog' })
    await user.type(field, 'Ideia nova{Enter}')
    await waitFor(() =>
      expect(s.add).toHaveBeenCalledWith({ projectId: PROJECT_ID, title: 'Ideia nova' }),
    )
    await waitFor(() => expect((field as HTMLInputElement).value).toBe(''))
  })

  it('botão "Adicionar ao backlog" inclui o item pelo backlog.add, sem precisar de Enter', async () => {
    const user = userEvent.setup()
    const s = setup()
    const field = await screen.findByRole('textbox', { name: 'Adicionar ao backlog' })
    await user.type(field, 'Ideia pelo botão')
    await user.click(screen.getByRole('button', { name: 'Adicionar ao backlog' }))
    await waitFor(() =>
      expect(s.add).toHaveBeenCalledWith({ projectId: PROJECT_ID, title: 'Ideia pelo botão' }),
    )
  })

  it('título vazio não chama o servidor e avisa', async () => {
    const user = userEvent.setup()
    const s = setup()
    await user.type(
      await screen.findByRole('textbox', { name: 'Adicionar ao backlog' }),
      '   {Enter}',
    )
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Informe o título do item.')
    expect(s.add).not.toHaveBeenCalled()
  })

  it('estado vazio com guia indisponível mostra a mensagem antiga do backlog', async () => {
    setup({ items: [], guideFails: true })
    expect(await screen.findByText('O backlog deste projeto está vazio.')).toBeTruthy()
    expect(screen.getByText(/Adicione ideias e pedidos acima/)).toBeTruthy()
  })

  it('estado vazio com guia carregado mostra o texto do manifesto do backlog', async () => {
    setup({ items: [] })
    expect(await screen.findByText('O backlog está vazio.')).toBeTruthy()
    expect(screen.getByText(/O backlog são as tarefas em Planejamento/)).toBeTruthy()
    expect(screen.queryByText('O backlog deste projeto está vazio.')).toBeNull()
  })

  it('erro ao carregar mostra alerta e tenta de novo', async () => {
    const user = userEvent.setup()
    let attempts = 0
    setup({
      items: () => {
        attempts += 1
        return attempts === 1
          ? Promise.reject(new Error('falhou'))
          : Promise.resolve([item(1, 'Revisar integração')])
      },
    })
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Não foi possível carregar o backlog.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('button', { name: 'Abrir Revisar integração' })).toBeTruthy()
  })

  it('carregando mostra o aviso de carregamento', async () => {
    setup({ items: () => new Promise<TaskDto[]>(() => undefined) })
    expect(await screen.findByText('Carregando o backlog…')).toBeTruthy()
  })
})

describe('Backlog: reordenar por teclado e por arrastar', () => {
  it('Descer manda o item depois do vizinho e anuncia a nova posição', async () => {
    const user = userEvent.setup()
    const s = setup()
    await user.click(await screen.findByRole('button', { name: 'Descer Revisar integração' }))
    await waitFor(() =>
      expect(s.reorder).toHaveBeenCalledWith({
        taskId: '01J8Y4G2XK8Z1S6M3Q9W0BK01',
        afterId: '01J8Y4G2XK8Z1S6M3Q9W0BK02',
      }),
    )
    const announcement = await screen.findByText('Revisar integração agora está na posição 2 de 3.')
    expect(announcement.closest('[aria-live="polite"]')).toBeTruthy()
  })

  it('depois de mover pelo teclado, o foco segue no botão do mesmo item', async () => {
    const user = userEvent.setup()
    setup()
    const down = await screen.findByRole('button', { name: 'Descer Revisar integração' })
    down.focus()
    await user.click(down)
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Descer Revisar integração' }),
      ),
    )
  })

  it('Subir manda o item antes do vizinho de cima', async () => {
    const user = userEvent.setup()
    const s = setup()
    await user.click(await screen.findByRole('button', { name: 'Subir Trocar ícone' }))
    await waitFor(() =>
      expect(s.reorder).toHaveBeenCalledWith({
        taskId: '01J8Y4G2XK8Z1S6M3Q9W0BK03',
        beforeId: '01J8Y4G2XK8Z1S6M3Q9W0BK02',
      }),
    )
  })

  it('o primeiro não sobe e o último não desce', async () => {
    setup()
    expect(
      (await screen.findByRole('button', { name: 'Subir Revisar integração' })).hasAttribute(
        'disabled',
      ),
    ).toBe(true)
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Descer Trocar ícone' }).disabled,
    ).toBe(true)
  })

  it('arrastar um item sobre outro chama reorder com o vizinho certo', async () => {
    const s = setup()
    await screen.findByRole('button', { name: 'Abrir Trocar ícone' })
    const dragged = rowOf('Trocar ícone')
    const target = rowOf('Revisar integração')
    fireEvent.dragStart(dragged)
    fireEvent.dragOver(target)
    fireEvent.drop(target)
    await waitFor(() =>
      expect(s.reorder).toHaveBeenCalledWith({
        taskId: '01J8Y4G2XK8Z1S6M3Q9W0BK03',
        beforeId: '01J8Y4G2XK8Z1S6M3Q9W0BK01',
      }),
    )
  })

  it('a ordem muda na tela antes do servidor responder (otimista)', async () => {
    const s = setup()
    await screen.findByRole('button', { name: 'Abrir Trocar ícone' })
    s.reorder.mockImplementation(() => new Promise(() => undefined))
    fireEvent.dragStart(rowOf('Trocar ícone'))
    fireEvent.drop(rowOf('Revisar integração'))
    await waitFor(() => {
      const titles = within(screen.getByRole('list', { name: 'Itens do backlog' }))
        .getAllByRole('button', { name: /^Abrir / })
        .map((button) => button.textContent)
      expect(titles).toEqual(['Trocar ícone', 'Revisar integração', 'Ajustar relatório'])
    })
  })

  it('recusa do servidor devolve a ordem anterior e avisa', async () => {
    const user = userEvent.setup()
    const s = setup()
    await screen.findByRole('button', { name: 'Abrir Trocar ícone' })
    s.reorder.mockRejectedValue(new Error('recusado'))
    await user.click(screen.getByRole('button', { name: 'Subir Trocar ícone' }))
    expect(
      await screen.findByText('Não foi possível reordenar. A ordem anterior foi restaurada.'),
    ).toBeTruthy()
    const titles = within(screen.getByRole('list', { name: 'Itens do backlog' }))
      .getAllByRole('button', { name: /^Abrir / })
      .map((button) => button.textContent)
    expect(titles).toEqual(['Revisar integração', 'Ajustar relatório', 'Trocar ícone'])
  })
})

describe('Backlog: puxar para o quadro', () => {
  it('puxa com o estado padrão A fazer', async () => {
    const user = userEvent.setup()
    const s = setup()
    await user.click(
      await screen.findByRole('button', { name: 'Puxar Revisar integração para o quadro' }),
    )
    await waitFor(() =>
      expect(s.pull).toHaveBeenCalledWith({ taskId: '01J8Y4G2XK8Z1S6M3Q9W0BK01', status: 'todo' }),
    )
  })

  it('puxa com o estado escolhido no seletor', async () => {
    const user = userEvent.setup()
    const s = setup()
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Estado ao puxar Ajustar relatório' }),
      'review',
    )
    await user.click(screen.getByRole('button', { name: 'Puxar Ajustar relatório para o quadro' }))
    await waitFor(() =>
      expect(s.pull).toHaveBeenCalledWith({
        taskId: '01J8Y4G2XK8Z1S6M3Q9W0BK02',
        status: 'review',
      }),
    )
  })

  it('recusa do servidor aparece em pt-BR', async () => {
    const user = userEvent.setup()
    const s = setup()
    const { ApiError } = await import('@agilebox/contract')
    s.pull.mockRejectedValue(new ApiError('CONFLICT', 'Tarefa não está no backlog'))
    await user.click(
      await screen.findByRole('button', { name: 'Puxar Trocar ícone para o quadro' }),
    )
    expect(await screen.findByText('Tarefa não está no backlog')).toBeTruthy()
  })
})

describe('Backlog: projetos e capacidades', () => {
  it('colaborador vê só os projetos de que participa; o gestor vê todos', async () => {
    const other: ProjectDto = { ...PROJECT, id: OTHER_PROJECT_ID, name: 'Projeto Beta' }
    setup({
      role: 'collaborator',
      projects: [PROJECT, other],
      members: { [PROJECT_ID]: [USER_ID], [OTHER_PROJECT_ID]: [MANAGER_ID] },
    })
    const select = await screen.findByRole('combobox', { name: 'Projeto' })
    await waitFor(() => expect(within(select).queryAllByRole('option')).toHaveLength(1))
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Projeto Aurora'])
  })

  it('gestor vê todos os projetos', async () => {
    const other: ProjectDto = { ...PROJECT, id: OTHER_PROJECT_ID, name: 'Projeto Beta' }
    setup({ projects: [PROJECT, other] })
    const select = await screen.findByRole('combobox', { name: 'Projeto' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Projeto Aurora', 'Projeto Beta'])
  })

  it('estimativa e x/y dos critérios só aparecem com a tela do módulo (Intermediário)', async () => {
    const withData = [
      item(1, 'Com dados', {
        estimatedHours: 2,
        criteriaProgress: { done: 1, total: 2 },
      }),
    ]
    setup({ items: withData })
    expect(await screen.findByText('Estimativa 2 h')).toBeTruthy()
    expect(screen.getByText('1/2 critérios')).toBeTruthy()
    cleanup()

    const { api } = setup({ items: withData, modules: KANBAN, level: 'basic' })
    await screen.findByRole('button', { name: 'Abrir Com dados' })
    await settleCapabilities(api)
    expect(screen.queryByText('Estimativa 2 h')).toBeNull()
    expect(screen.queryByText('1/2 critérios')).toBeNull()
  })

  it('com a ferramenta em encerramento, não cria item mas segue reordenando', async () => {
    const s = setup({
      modules: SCRUM.filter((id) => id !== 'backlog'),
      winding: ['backlog'],
    })
    await screen.findByRole('button', { name: 'Abrir Revisar integração' })
    expect(screen.queryByRole('textbox', { name: 'Adicionar ao backlog' })).toBeNull()
    expect(screen.getByText(/não aceita itens novos/)).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Descer Revisar integração' }).disabled,
    ).toBe(false)
    expect(s.add).not.toHaveBeenCalled()
  })
})
