import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { BoardView } from './BoardView'

afterEach(cleanup)

function makeTask(id: string, title: string): TaskDto {
  return {
    id,
    number: Number(id.slice(-3)) || 1,
    key: `AB-${id.slice(-3)}`,
    projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
    projectName: 'Projeto Aurora',
    title,
    description: '',
    status: 'todo',
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
}

const tasks = [
  makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B01', 'Mapear fluxo de aprovação'),
  makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B02', 'Ajustar webhook de boleto'),
]

function renderBoard() {
  return render(
    <ApiProvider api={createFakeApi()}>
      <QueryProvider>
        <BoardView
          tasks={tasks}
          loading={false}
          error={false}
          onOpenTask={() => undefined}
          onMoveTask={() => undefined}
        />
      </QueryProvider>
    </ApiProvider>,
  )
}

describe('Busca do quadro', () => {
  it('oferece um campo de busca por ID, título ou pessoa', () => {
    renderBoard()

    expect(
      screen
        .getByRole('searchbox', { name: 'Buscar tarefas no quadro' })
        .getAttribute('placeholder'),
    ).toBe('Buscar por ID, título ou pessoa...')
  })

  it('esconde as tarefas que não casam com o texto e atualiza a contagem', async () => {
    renderBoard()

    await userEvent
      .setup()
      .type(screen.getByRole('searchbox', { name: 'Buscar tarefas no quadro' }), 'webhook')

    expect(screen.queryByRole('button', { name: /^AB-B01 · / })).toBeNull()
    expect(screen.getByRole('button', { name: /^AB-B02 · / })).toBeTruthy()
    expect(screen.getByText(/^1 tarefa ·/)).toBeTruthy()
  })
})
