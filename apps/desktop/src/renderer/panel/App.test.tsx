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
})
