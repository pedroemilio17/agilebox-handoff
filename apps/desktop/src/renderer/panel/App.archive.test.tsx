import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DashboardDto, ProjectDto, SessionUserDto, TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import { App } from './App'
import { panelCopy } from './copy'
import { makeDetail } from './task-detail/fixtures'

afterEach(cleanup)

const ORG = '01J8Y4G2XK8Z1S6M3Q9W0A5G01'
const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const AURORA = '01J8Y4G2XK8Z1S6M3Q9W0A5BC1'
const BOREAL = '01J8Y4G2XK8Z1S6M3Q9W0A5BC2'

const users: SessionUserDto[] = [
  { id: MANAGER, name: 'Marta Gestora', initials: 'MG', role: 'manager', defaultRate: 80 },
]

const activeProject: ProjectDto = {
  id: AURORA,
  name: 'Projeto Aurora',
  createdBy: MANAGER,
  createdAt: '2026-10-31T12:00:00.000Z',
  definitionOfDoneCount: 0,
  archivedAt: null,
}
const archivedProject: ProjectDto = {
  id: BOREAL,
  name: 'Projeto Boreal',
  createdBy: MANAGER,
  createdAt: '2026-10-31T12:00:00.000Z',
  definitionOfDoneCount: 0,
  archivedAt: '2026-11-02T09:00:00.000Z',
}

const emptyDashboard: DashboardDto = {
  insights: {
    updatedAt: '2026-11-01T12:00:00Z',
    weekStart: '2026-10-26',
    projects: [],
    needs: [],
    updates: [],
    upToDatePercentage: null,
    agingCount: 0,
    overdueCount: 0,
    blockedCount: 0,
    overWipColumns: [],
    cycleDays: null,
    leadDays: null,
    throughput: 0,
    weeks: [],
    recentChanges: [],
    team: [],
  },
  distribution: { planning: 0, todo: 0, in_progress: 0, review: 0, done: 0 },
  collaborators: [],
}

function setup() {
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: MANAGER,
    organizationId: ORG,
    role: 'manager',
  })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue(users)
  vi.spyOn(api.projects, 'list').mockImplementation((input) =>
    Promise.resolve(input?.includeArchived ? [activeProject, archivedProject] : [activeProject]),
  )
  const listBoard = vi.spyOn(api.tasks, 'listBoard').mockResolvedValue({
    tasks: [] as TaskDto[],
    wipLimits: {},
    wipColumns: [],
  })
  vi.spyOn(api.tasks, 'listTeamBoard').mockResolvedValue([])
  vi.spyOn(api.tasks, 'getBoardFlow').mockResolvedValue({
    cycleDays: null,
    weekStart: '2026-10-26',
    updatedAt: '2026-11-01T12:00:00.000Z',
  })
  vi.spyOn(api.dashboard, 'get').mockResolvedValue(emptyDashboard)
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.tasks, 'get').mockResolvedValue(makeDetail())
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  vi.spyOn(api.contributors, 'list').mockResolvedValue([])
  vi.spyOn(api.meetings, 'listUpcoming').mockResolvedValue([])
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ApiProvider>,
  )
  return { listBoard, user: userEvent.setup() }
}

describe('Arquivadas no painel', () => {
  it('"Mostrar arquivados" pede as tarefas com includeArchived', async () => {
    const { listBoard, user } = setup()
    await waitFor(() => expect(listBoard).toHaveBeenCalled())
    expect(listBoard).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ includeArchived: true }),
    )
    await user.click(await screen.findByRole('button', { name: panelCopy.showArchived }))
    await waitFor(() =>
      expect(listBoard).toHaveBeenLastCalledWith(
        expect.objectContaining({ includeArchived: true }),
      ),
    )
  })

  it('projeto arquivado selecionado desabilita a criação de tarefa', async () => {
    const { user } = setup()
    // Abre o seletor de projetos, mostra os arquivados e escolhe o Boreal.
    await user.click(
      within(await screen.findByRole('banner')).getByRole('button', { name: /Todos os projetos/ }),
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: panelCopy.showArchived }))
    await user.click(within(dialog).getByRole('option', { name: /Projeto Boreal/ }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Nova tarefa' }).hasAttribute('disabled')).toBe(
        true,
      ),
    )
    expect(screen.getByRole('button', { name: 'Nova tarefa' }).getAttribute('title')).toBe(
      panelCopy.archivedProjectNewTask,
    )
  })
})
