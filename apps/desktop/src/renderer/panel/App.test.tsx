import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import { QueryProvider } from '../shared/query/QueryProvider'
import { App } from './App'

afterEach(cleanup)

const task: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
  projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
  projectName: 'Projeto Aurora',
  title: 'Revisar integração',
  description: '',
  status: 'review',
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
    createdAt: '2026-10-31T12:00:00.000Z',
  },
  {
    id: '01J8Y4G2XK8Z1S6M3Q9W0A5BC2',
    name: 'Projeto Boreal',
    createdAt: '2026-10-31T12:00:00.000Z',
  },
]

describe('Painel', () => {
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

    expect(await screen.findByRole('heading', { name: 'Revisar integração' })).toBeTruthy()
    expect(screen.getByText('Projeto Aurora')).toBeTruthy()
    expect(screen.getByText('Revisar')).toBeTruthy()
    expect(listBoard).toHaveBeenCalledWith({})
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
    expect(screen.getByRole('button', { name: 'Projetos' }).getAttribute('aria-current')).toBe(
      'page',
    )
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
