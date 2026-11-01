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
  projectId: projects[0]!.id,
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

const dashboard: DashboardDto = {
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

function setup(currentUserId: string) {
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
  const listBoard = vi.spyOn(api.tasks, 'listBoard').mockResolvedValue([task])
  vi.spyOn(api.dashboard, 'get').mockResolvedValue(dashboard)
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
    await screen.findByRole('button', { name: 'Revisar integração' })
    expect(screen.queryByRole('button', { name: 'Dashboard' })).toBeNull()
    cleanup()
    setup(MANAGER)
    expect(await screen.findByRole('button', { name: 'Dashboard' })).toBeTruthy()
  })

  it('troca de perfil pela conta e recarrega os dados', async () => {
    const { switchUser, listBoard, user } = setup(ANA)
    await screen.findByRole('button', { name: 'Revisar integração' })
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
  it('mostra porcentagens em texto e abre os projetos de um colaborador', async () => {
    const { listBoard, user } = setup(MANAGER)
    await user.click(await screen.findByRole('button', { name: 'Dashboard' }))
    const overview = await screen.findByRole('img', { name: /Distribuição das tarefas por estado/ })
    expect(overview.getAttribute('aria-label')).toContain('Concluído 25%')
    expect(screen.getByText('30%')).toBeTruthy()

    const row = screen.getByRole('row', { name: /Bruno Lima/ })
    expect(within(row).getByText('4')).toBeTruthy()
    expect(within(row).getByText('50%')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Abrir projetos de Bruno Lima' }))
    expect(await screen.findByText('Tarefas de Bruno Lima · editando como Gestor')).toBeTruthy()
    await waitFor(() => expect(listBoard).toHaveBeenLastCalledWith({ forUserId: BRUNO }))

    await user.click(screen.getByRole('button', { name: 'Voltar às minhas' }))
    expect(screen.queryByText(/editando como Gestor/)).toBeNull()
    await waitFor(() => expect(listBoard).toHaveBeenLastCalledWith({}))
  })
})

describe('Membros do projeto', () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>, projectName: string) {
    await user.click(await screen.findByRole('button', { name: /Todos os projetos/ }))
    await user.click(screen.getByRole('option', { name: projectName }))
    await user.click(await screen.findByRole('button', { name: new RegExp(projectName) }))
  }

  it('o criador vê o botão; quem não criou não vê', async () => {
    const { user } = setup(ANA)
    await openDialog(user, 'Projeto Aurora')
    expect(screen.getByRole('button', { name: 'Membros' })).toBeTruthy()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /Projeto Aurora/ }))
    await user.click(screen.getByRole('option', { name: 'Projeto Boreal' }))
    await user.click(await screen.findByRole('button', { name: /Projeto Boreal/ }))
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
    await user.click(await screen.findByRole('button', { name: 'Revisar integração' }))
    const description = await screen.findByLabelText('Descrição')
    await user.type(description, ' mais')
    await user.tab()
    expect(
      await screen.findByText('Você não tem permissão para fazer essa alteração.'),
    ).toBeTruthy()
  })
})
