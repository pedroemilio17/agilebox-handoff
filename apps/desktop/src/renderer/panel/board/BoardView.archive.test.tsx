import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { panelCopy } from '../copy'
import { BoardView } from './BoardView'

afterEach(cleanup)

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'

function makeTask(id: string, overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id,
    number: Number(id.slice(-3)) || 1,
    key: `AB-${id.slice(-3)}`,
    projectId: PROJECT_ID,
    projectName: 'Projeto Aurora',
    title: `Tarefa ${id.slice(-3)}`,
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
    archivedAt: null,
    ...overrides,
  }
}

const ACTIVE = makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B01')
const ARCHIVED = makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B02', {
  title: 'Tarefa antiga',
  status: 'in_progress',
  archivedAt: '2026-11-02T09:00:00.000Z',
})

function renderBoard(props: Partial<ComponentProps<typeof BoardView>> = {}) {
  const api = createFakeApi()
  return render(
    <ApiProvider api={api}>
      <QueryProvider>
        <BoardView
          tasks={[ACTIVE, ARCHIVED]}
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

describe('Arquivadas no quadro', () => {
  it('liga e desliga "Mostrar arquivados" pelo pai, desligado por padrão', async () => {
    const onShowArchivedChange = vi.fn()
    const user = userEvent.setup()
    renderBoard({ onShowArchivedChange, showArchived: false })
    const toggle = screen.getByRole('button', { name: panelCopy.showArchived })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    await user.click(toggle)
    expect(onShowArchivedChange).toHaveBeenCalledWith(true)
  })

  it('mostra a arquivada atenuada, com marcador, sem alça de arraste', () => {
    renderBoard({ showArchived: true, onShowArchivedChange: () => undefined })
    const card = screen.getByRole('button', { name: /Tarefa antiga.*arquivada/ })
    expect(within(card).getByText(panelCopy.archivedMarker)).toBeTruthy()
    expect(screen.queryByRole('button', { name: `${panelCopy.moveTask} Tarefa antiga` })).toBeNull()
    // A tarefa ativa segue arrastável.
    expect(screen.getByRole('button', { name: `${panelCopy.moveTask} Tarefa B01` })).toBeTruthy()
  })

  it('não conta arquivadas nos indicadores de exceção', () => {
    renderBoard({
      tasks: [ARCHIVED, makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B03', { blockedReason: 'Aguardando' })],
      showArchived: true,
      onShowArchivedChange: () => undefined,
    })
    expect(screen.getByRole('button', { name: 'Bloqueadas' })).toBeTruthy()
  })

  it('desabilita "+" das colunas com a dica do motivo', () => {
    renderBoard({ newTaskBlockedReason: 'Projeto arquivado', onCreateTask: () => undefined })
    const addButtons = screen.getAllByRole('button', { name: /^Nova tarefa em / })
    expect(addButtons.length).toBeGreaterThan(0)
    for (const button of addButtons) {
      expect((button as HTMLButtonElement).disabled).toBe(true)
      expect(button.getAttribute('title')).toBe('Projeto arquivado')
    }
  })

  it('mantém "+" habilitado sem motivo de bloqueio', () => {
    renderBoard({ onCreateTask: () => undefined })
    const addButtons = screen.getAllByRole('button', { name: /^Nova tarefa em / })
    expect(addButtons.some((button) => !(button as HTMLButtonElement).disabled)).toBe(true)
  })
})
