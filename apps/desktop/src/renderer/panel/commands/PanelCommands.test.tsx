import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { makeDetail, USER_ID } from '../task-detail/fixtures'
import { PanelCommands } from './PanelCommands'
afterEach(cleanup)
describe('comandos do painel', () => {
  it('cria com tokens interpretados e abre o detalhe por Shift Enter', async () => {
    const api = createFakeApi()
    const task = makeDetail()
    const create = vi.spyOn(api.tasks, 'create').mockResolvedValue(task)
    vi.spyOn(api.tasks, 'search').mockResolvedValue([])
    const onClose = vi.fn()
    const onOpenTask = vi.fn()
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <PanelCommands
            projects={[
              {
                id: task.projectId,
                name: 'AgileBox',
                createdBy: USER_ID,
                createdAt: task.createdAt,
              },
            ]}
            people={[
              {
                id: USER_ID,
                name: 'Ana Souza',
                initials: 'AS',
                role: 'collaborator',
                defaultRate: null,
              },
            ]}
            selectedProjectId={null}
            isManager={false}
            onClose={onClose}
            onOpenTask={onOpenTask}
            onNavigate={() => undefined}
          />
        </QueryProvider>
      </ApiProvider>,
    )
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
})
