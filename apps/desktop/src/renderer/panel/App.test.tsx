import { cleanup, render, screen } from '@testing-library/react'
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
})
