import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import type { DashboardDto, ProjectDto, SessionUserDto, TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import { App } from './App'
import { makeDetail } from './task-detail/fixtures'

afterEach(cleanup)

const ORG = '01J8Y4G2XK8Z1S6M3Q9W0A5G01'
const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const ANA = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'
const BRUNO = '01J8Y4G2XK8Z1S6M3Q9W0A5V03'

const users: SessionUserDto[] = [
  { id: MANAGER, name: 'Marta Gestora', initials: 'MG', role: 'manager', defaultRate: 80 },
  { id: ANA, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: null },
  { id: BRUNO, name: 'Bruno Lima', initials: 'BL', role: 'collaborator', defaultRate: null },
]

const projects: ProjectDto[] = [
  {
    id: '01J8Y4G2XK8Z1S6M3Q9W0A5BC1',
    name: 'Projeto Aurora',
    createdBy: ANA,
    createdAt: '2026-10-31T12:00:00.000Z',
  },
  {
    id: '01J8Y4G2XK8Z1S6M3Q9W0A5BC2',
    name: 'Projeto Boreal',
    createdBy: BRUNO,
    createdAt: '2026-10-31T12:00:00.000Z',
  },
]

const task: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
  number: 118,
  key: 'AB-118',
  projectId: projects[0]!.id,
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

const dashboard: DashboardDto = {
  insights: {
    updatedAt: '2026-11-01T12:00:00Z',
    weekStart: '2026-10-26',
    upToDatePercentage: 75,
    agingCount: 1,
    overdueCount: 0,
    blockedCount: 0,
    cycleDays: 3,
    leadDays: 5,
    throughput: 2,
    weeks: [
      { start: '2026-10-19', throughput: 1, cycleDays: 6, leadDays: 8, upToDatePercentage: 50 },
      { start: '2026-10-26', throughput: 2, cycleDays: 3, leadDays: 5, upToDatePercentage: 75 },
    ],
    recentChanges: [],
    team: [
      {
        user: { id: BRUNO, name: 'Bruno Lima', initials: 'BL', role: 'collaborator' },
        inProgress: 2,
        agingCount: 1,
        overdueCount: 0,
        blockedCount: 0,
        lastUpdatedAt: '2026-10-31T12:00:00Z',
      },
    ],
  },
  distribution: { planning: 10, todo: 20, in_progress: 30, review: 15, done: 25 },
  collaborators: [
    {
      user: { id: BRUNO, name: 'Bruno Lima', initials: 'BL', role: 'collaborator' },
      taskCount: 4,
      distribution: { planning: 0, todo: 25, in_progress: 25, review: 0, done: 50 },
      completedPercentage: 50,
    },
  ],
}

function setup(
  currentUserId: string,
  boardTasks: TaskDto[] = [task],
  dashboardData: DashboardDto = dashboard,
) {
  let current = currentUserId
  const api = createFakeApi()
  const role = () => (current === MANAGER ? ('manager' as const) : ('collaborator' as const))
  vi.spyOn(api.session, 'getCurrent').mockImplementation(() =>
    Promise.resolve({ userId: current, organizationId: ORG, role: role() }),
  )
  vi.spyOn(api.session, 'listUsers').mockResolvedValue(users)
  const switchUser = vi.spyOn(api.session, 'switchUser').mockImplementation(({ userId }) => {
    current = userId
    return Promise.resolve({ userId, organizationId: ORG, role: role() })
  })
  vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
  const listBoard = vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardTasks)
  vi.spyOn(api.dashboard, 'get').mockResolvedValue(dashboardData)
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  vi.spyOn(api.contributors, 'list').mockResolvedValue([])
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, listBoard, switchUser, user: userEvent.setup() }
}

describe('Perfis e permissões na tela', () => {
  it('colaborador não vê o item Dashboard; gestor vê', async () => {
    setup(ANA)
    await screen.findByRole('button', { name: 'AB-118 · Revisar integração' })
    expect(screen.queryByRole('button', { name: 'Dashboard' })).toBeNull()
    cleanup()
    setup(MANAGER)
    expect(await screen.findByRole('button', { name: 'Dashboard' })).toBeTruthy()
  })

  it('troca de perfil pela conta e recarrega os dados', async () => {
    const { switchUser, listBoard, user } = setup(ANA)
    await screen.findByRole('button', { name: 'AB-118 · Revisar integração' })
    expect(screen.queryByRole('button', { name: 'Dashboard' })).toBeNull()
    const callsBefore = listBoard.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Conta' }))
    await user.click(screen.getByRole('menuitemradio', { name: /Marta Gestora/ }))

    expect(switchUser).toHaveBeenCalledWith({ userId: MANAGER })
    expect(await screen.findByRole('button', { name: 'Dashboard' })).toBeTruthy()
    await waitFor(() => expect(listBoard.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('mostra o perfil atual marcado no menu da conta', async () => {
    const { user } = setup(ANA)
    await user.click(await screen.findByRole('button', { name: 'Conta' }))
    expect(
      screen.getByRole('menuitemradio', { name: /Ana Souza/ }).getAttribute('aria-checked'),
    ).toBe('true')
  })
})

describe('Dashboard do gestor', () => {
  it('seleciona semana e mostra o histórico de adesão e fluxo correspondente', async () => {
    const { user } = setup(MANAGER)
    await user.click(await screen.findByRole('button', { name: 'Dashboard' }))
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Semana do dashboard' }),
      '2026-10-19',
    )
    expect(screen.getByText('50')).toBeTruthy()
    expect(screen.getByText('6d')).toBeTruthy()
    expect(
      screen
        .getByRole('img', { name: /Quadro em dia nas últimas seis semanas/ })
        .getAttribute('aria-label'),
    ).toContain('50')
  })

  it('mostra as bloqueadas no dashboard e abre o quadro com o filtro', async () => {
    const insights = dashboard.insights!
    const blockedDashboard: DashboardDto = {
      ...dashboard,
      insights: {
        ...insights,
        blockedCount: 1,
        team: insights.team.map((person) => ({ ...person, blockedCount: 1 })),
      },
    }
    const { user } = setup(
      MANAGER,
      [{ ...task, blockedReason: 'Aguardando GLPI', blockedAt: '2026-11-01T12:00:00.000Z' }],
      blockedDashboard,
    )
    await user.click(await screen.findByRole('button', { name: 'Dashboard' }))
    const row = await screen.findByRole('button', { name: 'Abrir projetos de Bruno Lima' })
    expect(within(row).getByText('1 bloqueada')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Bloqueadas.*com motivo registrado/ }))
    const filter = await screen.findByRole('button', { name: 'Bloqueadas · 1' })
    expect(filter.getAttribute('aria-pressed')).toBe('true')
    expect(
      screen.getByRole('button', { name: `${task.key} · ${task.title}, bloqueada` }),
    ).toBeTruthy()
  })

  it('abre o quadro com o filtro da métrica selecionada', async () => {
    const { user } = setup(MANAGER, [{ ...task, agingDays: 5, overdue: false }])
    await user.click(await screen.findByRole('button', { name: 'Dashboard' }))
    await user.click(await screen.findByRole('button', { name: /Paradas.*há mais de 4 dias/ }))
    const filter = await screen.findByRole('button', { name: 'Paradas · 1' })
    expect(filter.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: `${task.key} · ${task.title}` })).toBeTruthy()
  })

  it('mostra adesão, fluxo e sinais e abre os projetos de um colaborador', async () => {
    const { listBoard, user } = setup(MANAGER)
    await user.click(await screen.findByRole('button', { name: 'Dashboard' }))
    expect(await screen.findByRole('region', { name: 'Quadro em dia' })).toBeTruthy()
    expect(screen.getByText('75')).toBeTruthy()
    expect(screen.getByRole('img', { name: /Concluídas por semana/ })).toBeTruthy()
    const row = screen.getByRole('button', { name: 'Abrir projetos de Bruno Lima' })
    expect(within(row).getByText('2')).toBeTruthy()
    expect(within(row).getByText('1 parada')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Abrir projetos de Bruno Lima' }))
    expect(await screen.findByRole('status', { name: 'Tarefas de Bruno Lima' })).toBeTruthy()
    await waitFor(() => expect(listBoard).toHaveBeenLastCalledWith({ forUserId: BRUNO }))

    await user.click(screen.getByRole('button', { name: 'Voltar às minhas' }))
    expect(screen.queryByText('Edições aparecem como gestor')).toBeNull()
    await waitFor(() => expect(listBoard).toHaveBeenLastCalledWith({}))
  })
})

describe('Membros do projeto', () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>, projectName: string) {
    await user.click(
      await screen.findByRole('button', { name: /Projeto atual: Todos os projetos/ }),
    )
    await user.click(screen.getByRole('option', { name: projectName }))
    await user.click(
      await screen.findByRole('button', { name: new RegExp(`Projeto atual: ${projectName}`) }),
    )
  }

  it('o criador vê o botão; quem não criou não vê', async () => {
    const { user } = setup(ANA)
    await openDialog(user, 'Projeto Aurora')
    expect(screen.getByRole('button', { name: 'Membros' })).toBeTruthy()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /Projeto atual: Projeto Aurora/ }))
    await user.click(screen.getByRole('option', { name: 'Projeto Boreal' }))
    await user.click(await screen.findByRole('button', { name: /Projeto atual: Projeto Boreal/ }))
    expect(screen.queryByRole('button', { name: 'Membros' })).toBeNull()
  })

  it('o gestor vê o botão em qualquer projeto e gerencia os membros', async () => {
    const { api, user } = setup(MANAGER)
    vi.spyOn(api.projects, 'listMembers').mockResolvedValue(
      [users[1]!].map(({ id, name, initials, role }) => ({ id, name, initials, role })),
    )
    const addMember = vi.spyOn(api.projects, 'addMember').mockResolvedValue(undefined)
    const removeMember = vi.spyOn(api.projects, 'removeMember').mockResolvedValue(undefined)
    await openDialog(user, 'Projeto Boreal')
    await user.click(screen.getByRole('button', { name: 'Membros' }))
    expect(await screen.findByText('Ana Souza', { selector: 'span' })).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('Adicionar membro'), 'Bruno Lima')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() =>
      expect(addMember).toHaveBeenCalledWith({ projectId: projects[1]!.id, userId: BRUNO }),
    )
    await user.click(screen.getByRole('button', { name: 'Remover Ana Souza' }))
    await waitFor(() =>
      expect(removeMember).toHaveBeenCalledWith({ projectId: projects[1]!.id, userId: ANA }),
    )
  })
})

describe('Erros de permissão', () => {
  it('permissão negada ao salvar vira aviso curto', async () => {
    const { api, user } = setup(ANA)
    vi.spyOn(api.tasks, 'get').mockResolvedValue(makeDetail({ id: task.id }))
    vi.spyOn(api.tasks, 'update').mockRejectedValue(new ApiError('FORBIDDEN', 'Sem permissão'))
    await user.click(await screen.findByRole('button', { name: 'AB-118 · Revisar integração' }))
    const description = await screen.findByLabelText('Descrição')
    await user.type(description, ' mais')
    await user.tab()
    expect(
      await screen.findByText('Você não tem permissão para fazer essa alteração.'),
    ).toBeTruthy()
  })
})
