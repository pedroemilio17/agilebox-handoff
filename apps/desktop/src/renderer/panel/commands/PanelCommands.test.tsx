import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SidebarScreenId } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { makeDetail, USER_ID } from '../task-detail/fixtures'
import { PanelCommands } from './PanelCommands'
afterEach(cleanup)

const task = makeDetail()
const projects = [
  {
    id: task.projectId,
    name: 'AgileBox',
    createdBy: USER_ID,
    createdAt: task.createdAt,
  },
]
const people = [
  {
    id: USER_ID,
    name: 'Ana Souza',
    initials: 'AS',
    role: 'collaborator' as const,
    defaultRate: null,
  },
]

function renderPalette(
  screens: readonly SidebarScreenId[],
  handlers: { onClose?: () => void; onOpenTask?: (id: string) => void } = {},
) {
  const api = createFakeApi()
  vi.spyOn(api.tasks, 'search').mockResolvedValue([])
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <PanelCommands
          projects={projects}
          people={people}
          selectedProjectId={null}
          screens={screens}
          onClose={handlers.onClose ?? (() => undefined)}
          onOpenTask={handlers.onOpenTask ?? (() => undefined)}
          onNavigate={() => undefined}
        />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api }
}

describe('comandos do painel', () => {
  it('cria com tokens interpretados e abre o detalhe por Shift Enter', async () => {
    const onClose = vi.fn()
    const onOpenTask = vi.fn()
    const { api } = renderPalette(['projects', 'agenda'], { onClose, onOpenTask })
    const create = vi.spyOn(api.tasks, 'create').mockResolvedValue(task)
    const user = userEvent.setup()
    await user.type(screen.getByRole('combobox'), 'Revisar release @AS #AgileBox hoje')
    expect(screen.getByText('@Ana Souza')).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Dashboard/ })).toBeNull()
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: task.projectId,
          title: 'Revisar release',
          status: 'todo',
          responsibleId: USER_ID,
        }),
      ),
    )
    expect(create.mock.calls[0]?.[0]?.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(onOpenTask).toHaveBeenCalledWith(task.id)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('não lista Dashboard nem Agenda quando o servidor não libera as telas', () => {
    renderPalette(['projects'])

    expect(screen.getByRole('option', { name: /Quadro/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Agenda/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /Dashboard/ })).toBeNull()
  })

  it('lista Dashboard só quando o servidor libera a tela (gestor)', () => {
    renderPalette(['projects', 'agenda', 'dashboard'])

    expect(screen.getByRole('option', { name: /Dashboard/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Agenda/ })).toBeTruthy()
  })
})
