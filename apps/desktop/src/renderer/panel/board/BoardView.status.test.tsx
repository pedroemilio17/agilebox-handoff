import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import type { TaskDto } from '@agilebox/contract'
import { BoardView } from './BoardView'

afterEach(cleanup)

const MINUTE = 60_000

function renderBoard(props: Partial<ComponentProps<typeof BoardView>> = {}) {
  const api = createFakeApi()
  return render(
    <ApiProvider api={api}>
      <QueryProvider>
        <BoardView
          tasks={[]}
          loading={false}
          error={false}
          onOpenTask={() => undefined}
          onMoveTask={() => undefined}
          {...props}
        />
      </QueryProvider>
    </ApiProvider>,
  )
}

describe('Cabeçalho e estado vazio do quadro', () => {
  it('mostra o estado global vazio com ação de nova tarefa', async () => {
    const onNewTask = vi.fn()
    renderBoard({ onNewTask })

    expect(screen.getByRole('status', { name: 'Nenhuma tarefa ainda' })).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('button', { name: /Nova tarefa/ }))
    expect(onNewTask).toHaveBeenCalledTimes(1)
  })

  it('não mostra o estado vazio enquanto há tarefas no filtro atual', () => {
    renderBoard({
      tasks: [
        {
          id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
          number: 118,
          key: 'AB-118',
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
        },
      ],
    })

    expect(screen.queryByText('Nenhuma tarefa ainda')).toBeNull()
  })

  it('informa a contagem e há quanto tempo o quadro foi atualizado', () => {
    renderBoard({ updatedAt: Date.now() - 4 * MINUTE })

    expect(screen.getByText('0 tarefas · atualizado há 4 min')).toBeTruthy()
  })

  it('mostra atualização em andamento sem esconder o momento anterior', () => {
    renderBoard({ updatedAt: Date.now() - 4 * MINUTE, refreshing: true })

    expect(screen.getByText('0 tarefas · atualizando…')).toBeTruthy()
  })

  it('mostra travessão quando ainda não há momento de atualização', () => {
    renderBoard()

    expect(screen.getByText('0 tarefas · —')).toBeTruthy()
  })

  it('mostra o ID da tarefa no card e o inclui no nome acessível', () => {
    const task: TaskDto = {
      id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
      number: 118,
      key: 'AB-118',
      projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
      projectName: 'Projeto Aurora',
      title: 'Revisar integração',
      description: '',
      status: 'todo',
      deadline: null,
      ticketId: null,
      ticketUrl: null,
      createdAt: '2026-10-31T12:00:00.000Z',
      updatedAt: '2026-10-31T12:00:00.000Z',
    }
    renderBoard({ tasks: [task] })

    expect(screen.getByText('AB-118')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'AB-118 · Revisar integração' })).toBeTruthy()
  })
})
