import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import { QueryProvider } from '../shared/query/QueryProvider'
import { App } from './App'
import { makeDetail } from './task-detail/fixtures'

afterEach(cleanup)

const task: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
  number: 118,
  key: 'AB-118',
  projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
  projectName: 'Projeto Aurora',
  title: 'Revisar integração',
  description: '',
  status: 'review',
  priority: 'normal',
  blockedReason: null,
  blockedAt: null,
  checklistProgress: { done: 0, total: 0, percent: 0 },
  deadline: null,
  ticketId: null,
  ticketUrl: null,
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
}

const projects = [
  {
    id: '01J8Y4G2XK8Z1S6M3Q9W0A5BC1',
    name: 'Projeto Aurora',
    createdBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
    createdAt: '2026-10-31T12:00:00.000Z',
  },
  {
    id: '01J8Y4G2XK8Z1S6M3Q9W0A5BC2',
    name: 'Projeto Boreal',
    createdBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
    createdAt: '2026-10-31T12:00:00.000Z',
  },
]

describe('Painel', () => {
  it('mostra o ciclo médio autorizado no rodapé de Concluído', async () => {
    const api = createFakeApi()
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([])
    const flow = vi.spyOn(api.tasks, 'getBoardFlow').mockResolvedValue({
      cycleDays: 4.2,
      weekStart: '2026-10-26',
      updatedAt: '2026-11-01T12:00:00Z',
    })
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )
    expect(
      await within(await screen.findByRole('region', { name: 'Concluído, tarefas' })).findByText(
        'Ciclo médio desta semana: 4,2d',
      ),
    ).toBeTruthy()
    expect(flow).toHaveBeenCalledWith({})
  })

  it('abre a paleta por Ctrl K e pela barra, fecha por Esc e devolve foco', async () => {
    const api = createFakeApi()
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([])
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )
    const user = userEvent.setup()
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByRole('dialog', { name: 'Buscar ou criar' })).toBeTruthy()
    await user.keyboard('{Escape}')
    const trigger = screen.getByRole('button', { name: 'Buscar ou criar' })
    await user.click(trigger)
    await user.type(screen.getByRole('combobox', { name: 'Buscar ou criar tarefa' }), 'n')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await user.keyboard('{Escape}')
    expect(document.activeElement).toBe(trigger)
  })
  it('navega com G A e abre criação com N fora de campos', async () => {
    const api = createFakeApi()
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([])
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )
    const user = userEvent.setup()
    await user.keyboard('ga')
    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeTruthy()
    await user.keyboard('n')
    expect(await screen.findByRole('dialog', { name: 'Nova tarefa' })).toBeTruthy()
    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'ga n')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('mantém o quadro no painel lateral, troca de tarefa e retorna o foco ao cartão ao fechar', async () => {
    const api = createFakeApi()
    const second = { ...task, id: projects[0]!.id, title: 'Outra tarefa' }
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([task, second])
    vi.spyOn(api.tasks, 'get').mockImplementation(({ taskId }) =>
      Promise.resolve({ ...makeDetail(), ...(taskId === second.id ? second : task) }),
    )
    vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
    vi.spyOn(api.timeline, 'list').mockResolvedValue([])
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: `${task.key} · ${task.title}` }))
    const dialog = await screen.findByRole('dialog', { name: task.title })
    expect(dialog.hasAttribute('aria-modal')).toBe(false)
    expect(
      screen
        .getByRole('button', { name: `${task.key} · ${task.title}` })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    await user.click(screen.getByRole('button', { name: `${second.key} · ${second.title}` }))
    expect(await screen.findByDisplayValue(second.title)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Abrir em tela cheia' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: `${second.key} · ${second.title}` })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Voltar ao painel lateral' }))
    const title = await screen.findByLabelText('Título da tarefa')
    await user.click(title)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: `${second.key} · ${second.title}` }),
      ),
    )
  })

  it('filtra sinais derivados sem perder as contagens do quadro e permite limpar o filtro', async () => {
    const api = createFakeApi()
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([
      { ...task, title: 'Tarefa parada', agingDays: 5, overdue: false },
      { ...task, id: projects[0]!.id, title: 'Tarefa vencida', agingDays: null, overdue: true },
      { ...task, id: projects[1]!.id, title: 'Tarefa em dia', agingDays: 1, overdue: false },
    ])
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )
    const aging = await screen.findByRole('button', { name: 'Paradas · 1' })
    expect(screen.getByText('parada 5d')).toBeTruthy()
    await userEvent.click(aging)
    expect(screen.queryByRole('button', { name: 'AB-118 · Tarefa vencida' })).toBeNull()
    expect(screen.getByRole('button', { name: 'AB-118 · Tarefa parada' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Vencidas · 1' }))
    expect(screen.queryByRole('button', { name: 'AB-118 · Tarefa parada' })).toBeNull()
    expect(screen.getByRole('button', { name: 'AB-118 · Tarefa vencida' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Vencidas · 1' }))
    expect(screen.getByRole('button', { name: 'AB-118 · Tarefa em dia' })).toBeTruthy()
  })

  it('o botão da coluna cria no estado correspondente', async () => {
    const api = createFakeApi()
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([])
    const create = vi.spyOn(api.tasks, 'create').mockResolvedValue({ ...task, status: 'review' })
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Nova tarefa em Revisar' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Revisar release')
    await userEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }))
    expect(create).toHaveBeenCalledWith({
      projectId: projects[0]!.id,
      title: 'Revisar release',
      status: 'review',
    })
  })

  it('seleciona projeto pela barra lateral e preserva a contagem de todos os projetos', async () => {
    const api = createFakeApi()
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    const listBoard = vi
      .spyOn(api.tasks, 'listBoard')
      .mockResolvedValue([{ ...task, projectId: projects[0]!.id }])
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )
    const nav = within(screen.getByRole('navigation'))
    const project = await nav.findByRole('button', { name: /Projeto Boreal/ })
    await userEvent.click(project)
    expect(listBoard).toHaveBeenLastCalledWith({ projectId: projects[1]!.id })
    expect(project.getAttribute('aria-pressed')).toBe('true')
    expect(nav.getByRole('button', { name: /Projeto Aurora/ }).textContent).toContain('1')
    expect(nav.getByRole('button', { name: /Plug-ins/ }).hasAttribute('disabled')).toBe(true)
  })

  it('lista tarefas da API com estado e projeto', async () => {
    const api = createFakeApi()
    const listBoard = vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([task])

    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    expect(await screen.findByRole('button', { name: 'AB-118 · Revisar integração' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Revisar, tarefas' })).toBeTruthy()
    expect(listBoard).toHaveBeenCalledWith({})
  })

  it('move a tarefa para o estado escolhido pelo controle de teclado', async () => {
    const api = createFakeApi()
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([task])
    const move = vi.spyOn(api.tasks, 'move')
    const user = userEvent.setup()

    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    await user.selectOptions(
      await screen.findByRole('combobox', {
        name: 'Mover Revisar integração para outro estado',
      }),
      'in_progress',
    )

    expect(move).toHaveBeenCalledWith({ taskId: task.id, status: 'in_progress' })
  })

  it('agrupa as tarefas nas cinco colunas na ordem do fluxo', async () => {
    const api = createFakeApi()
    const statuses = ['planning', 'todo', 'in_progress', 'review', 'done'] as const
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(
      statuses.map((status, index) => ({ ...task, id: `${task.id.slice(0, -1)}${index}`, status })),
    )

    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    const columns = await screen.findAllByRole('region', { name: /tarefas$/i })
    expect(columns.map((column) => column.getAttribute('aria-label'))).toEqual([
      'Planejamento, tarefas',
      'A fazer, tarefas',
      'Desenvolvendo, tarefas',
      'Revisar, tarefas',
      'Concluído, tarefas',
    ])
    expect(screen.getAllByRole('button', { name: 'AB-118 · Revisar integração' })).toHaveLength(5)
  })

  it('filtra a consulta do quadro pelo projeto escolhido', async () => {
    const api = createFakeApi()
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    const listBoard = vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([])
    const user = userEvent.setup()

    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    await user.click(
      await screen.findByRole('button', {
        name: 'Projeto atual: Todos os projetos. Trocar de projeto',
      }),
    )
    await user.click(await screen.findByRole('option', { name: 'Projeto Boreal' }))
    expect(listBoard).toHaveBeenLastCalledWith({ projectId: projects[1]?.id })
  })

  it('mostra o estado vazio em cada coluna sem tarefas', async () => {
    const api = createFakeApi()
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([])

    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    expect(await screen.findAllByText('Nada aqui.')).toHaveLength(5)
  })

  it('navega entre visões e mantém os rótulos acessíveis', async () => {
    const api = createFakeApi()

    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(navigation).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quadro' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Nova tarefa' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Controles da janela' })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Agenda' }))
    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeTruthy()
  })

  it('oculta Dashboard para colaborador', async () => {
    const api = createFakeApi()
    vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
      userId: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
      organizationId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
      role: 'collaborator',
    })

    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    await screen.findByRole('navigation', { name: 'Navegação principal' })
    expect(screen.queryByRole('button', { name: 'Dashboard' })).toBeNull()
  })

  it('abre a lista com todos os projetos primeiro e marca a opção atual', async () => {
    const api = createFakeApi()
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    const user = userEvent.setup()
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    const title = await screen.findByRole('button', {
      name: 'Projeto atual: Todos os projetos. Trocar de projeto',
    })
    await user.click(title)
    const options = await screen.findAllByRole('option')
    expect(options.map((option) => option.firstElementChild?.textContent)).toEqual([
      'Todos os projetos',
      'Projeto Aurora',
      'Projeto Boreal',
    ])
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')
  })

  it('troca para um projeto escolhido', async () => {
    const api = createFakeApi()
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    const user = userEvent.setup()
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    await user.click(
      await screen.findByRole('button', {
        name: 'Projeto atual: Todos os projetos. Trocar de projeto',
      }),
    )
    await user.click(await screen.findByRole('option', { name: 'Projeto Aurora' }))
    expect(
      screen.getByRole('button', { name: 'Projeto atual: Projeto Aurora. Trocar de projeto' }),
    ).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Projetos' })).toBeNull()
  })

  it('cria projeto e seleciona o projeto criado', async () => {
    const created = { ...projects[0]!, name: 'Projeto Novo' }
    let hasCreated = false
    const api = createFakeApi()
    vi.spyOn(api.projects, 'list').mockImplementation(() =>
      Promise.resolve(hasCreated ? [created] : []),
    )
    const create = vi.spyOn(api.projects, 'create').mockImplementation(() => {
      hasCreated = true
      return Promise.resolve(created)
    })
    const user = userEvent.setup()
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    await user.click(
      await screen.findByRole('button', {
        name: 'Projeto atual: Todos os projetos. Trocar de projeto',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Novo projeto' }))
    await user.type(screen.getByRole('textbox', { name: 'Nome do novo projeto' }), 'Projeto Novo')
    await user.click(screen.getByRole('button', { name: 'Criar' }))
    expect(create).toHaveBeenCalledWith({ name: 'Projeto Novo' })
    expect(
      await screen.findByRole('button', { name: 'Projeto atual: Projeto Novo. Trocar de projeto' }),
    ).toBeTruthy()
  })

  it('cria tarefa no projeto selecionado e abre seu detalhe', async () => {
    const createdTask: TaskDto = {
      ...task,
      id: '01J8Y4G2XK8Z1S6M3Q9W0A5BC99',
      projectId: projects[1]!.id,
      projectName: projects[1]!.name,
      title: 'Preparar release',
    }
    const api = createFakeApi()
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([])
    const create = vi.spyOn(api.tasks, 'create').mockResolvedValue(createdTask)
    const recordOpen = vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Nova tarefa' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Projeto' }), projects[1]!.id)
    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Preparar release')
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    expect(create).toHaveBeenCalledWith({ projectId: projects[1]!.id, title: 'Preparar release' })
    expect(await screen.findByRole('region', { name: 'Detalhe da tarefa' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Voltar ao quadro/ })).toBeTruthy()
    expect(recordOpen).toHaveBeenCalledWith({ taskId: createdTask.id })
  })

  it('mantém a criação desabilitada enquanto o título estiver vazio', async () => {
    const api = createFakeApi()
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    const user = userEvent.setup()

    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Nova tarefa' }))

    expect(screen.getByRole('button', { name: 'Criar tarefa' }).hasAttribute('disabled')).toBe(true)
  })

  it('seleciona projeto com nome repetido sem criar outro', async () => {
    const api = createFakeApi()
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    const create = vi.spyOn(api.projects, 'create')
    const user = userEvent.setup()
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    await user.click(
      await screen.findByRole('button', {
        name: 'Projeto atual: Todos os projetos. Trocar de projeto',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Novo projeto' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Nome do novo projeto' }),
      '  projeto aurora  ',
    )
    await user.click(screen.getByRole('button', { name: 'Criar' }))
    expect(create).not.toHaveBeenCalled()
    expect(
      await screen.findByRole('button', {
        name: 'Projeto atual: Projeto Aurora. Trocar de projeto',
      }),
    ).toBeTruthy()
  })

  it('fecha com Escape e devolve o foco ao título do projeto', async () => {
    const api = createFakeApi()
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    const user = userEvent.setup()
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ApiProvider>,
    )

    const title = await screen.findByRole('button', {
      name: 'Projeto atual: Todos os projetos. Trocar de projeto',
    })
    await user.click(title)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Projetos' })).toBeNull()
    expect(document.activeElement).toBe(title)
  })
})
