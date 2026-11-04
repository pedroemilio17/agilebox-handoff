import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  DashboardDto,
  ListBoardDto,
  ProjectDto,
  SessionUserDto,
  TaskDto,
} from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import { App } from './App'
import { panelCopy } from './copy'
import { makeDetail, makeParticipation } from './task-detail/fixtures'

afterEach(cleanup)

const ORG = '01J8Y4G2XK8Z1S6M3Q9W0A5G01'
const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const ANA = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'
const BRUNO = '01J8Y4G2XK8Z1S6M3Q9W0A5V03'
const AURORA = '01J8Y4G2XK8Z1S6M3Q9W0A5BC1'
const BOREAL = '01J8Y4G2XK8Z1S6M3Q9W0A5BC2'

const users: SessionUserDto[] = [
  { id: MANAGER, name: 'Marta Gestora', initials: 'MG', role: 'manager', defaultRate: 80 },
  { id: ANA, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: null },
  { id: BRUNO, name: 'Bruno Lima', initials: 'BL', role: 'collaborator', defaultRate: null },
]

const projects: ProjectDto[] = [
  {
    id: AURORA,
    name: 'Projeto Aurora',
    createdBy: ANA,
    createdAt: '2026-10-31T12:00:00.000Z',
    definitionOfDoneCount: 0,
  },
  {
    id: BOREAL,
    name: 'Projeto Boreal',
    createdBy: BRUNO,
    createdAt: '2026-10-31T12:00:00.000Z',
    definitionOfDoneCount: 0,
  },
]

function makeTask(id: string, overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id,
    number: 118,
    key: 'AB-118',
    projectId: AURORA,
    projectName: 'Projeto Aurora',
    title: 'Revisar integração',
    description: '',
    status: 'review',
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
    ...overrides,
  }
}

const mineTask = makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5BCD')
const teamTask = makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5T01', {
  key: 'AB-119',
  number: 119,
  title: 'Relatório mensal',
  status: 'in_progress',
  projectId: AURORA,
})

const emptyDashboard: DashboardDto = {
  insights: {
    updatedAt: '2026-11-01T12:00:00Z',
    weekStart: '2026-10-26',
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

interface SetupOptions {
  readonly userId?: string
  readonly mine?: TaskDto[]
  readonly board?: Pick<ListBoardDto, 'wipLimits' | 'wipColumns'>
  readonly team?: TaskDto[] | Promise<TaskDto[]> | (() => Promise<TaskDto[]>)
}

function setup({
  userId = ANA,
  mine = [mineTask],
  board = { wipLimits: {}, wipColumns: [] },
  team = [teamTask],
}: SetupOptions = {}) {
  const api = createFakeApi()
  const role = userId === MANAGER ? ('manager' as const) : ('collaborator' as const)
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId,
    organizationId: ORG,
    role,
  })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue(users)
  vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
  vi.spyOn(api.tasks, 'listBoard').mockResolvedValue({ tasks: mine, ...board })
  vi.spyOn(api.dashboard, 'get').mockResolvedValue(emptyDashboard)
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  vi.spyOn(api.contributors, 'list').mockResolvedValue([])
  vi.spyOn(api.tasks, 'get').mockImplementation(({ taskId }) =>
    Promise.resolve(
      makeDetail({
        id: taskId,
        key: 'AB-119',
        title: 'Relatório mensal',
        // O servidor pode permitir edição a quem tem acesso: a Equipe abre só para leitura mesmo assim.
        canEdit: true,
        readOnly: false,
        participations: [makeParticipation({ participantName: 'Bruno Lima' })],
      }),
    ),
  )
  const listTeamBoard = vi
    .spyOn(api.tasks, 'listTeamBoard')
    .mockImplementation(() =>
      typeof team === 'function' ? team() : Array.isArray(team) ? Promise.resolve(team) : team,
    )
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, listTeamBoard, user: userEvent.setup() }
}

function scopeGroup() {
  return screen.findByRole('group', { name: panelCopy.taskScope })
}

function liveRegionText() {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? ''
}

describe('seletor Minhas tarefas | Equipe', () => {
  it('é um grupo rotulado com o estado selecionado em cada opção', async () => {
    const { user } = setup()
    const group = await scopeGroup()
    expect(within(group).getByRole('button', { name: 'Minhas' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    await user.click(within(group).getByRole('button', { name: 'Equipe' }))
    expect(within(group).getByRole('button', { name: 'Equipe' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(within(group).getByRole('button', { name: 'Minhas' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('Equipe chama a API da equipe e mostra as tarefas dos outros em somente leitura', async () => {
    const { user, listTeamBoard } = setup()
    await user.click(within(await scopeGroup()).getByRole('button', { name: 'Equipe' }))

    expect(listTeamBoard).toHaveBeenCalledWith({})
    expect(
      await screen.findByRole('button', {
        name: 'AB-119 Relatório mensal, Desenvolvendo, Bruno Lima, somente leitura',
      }),
    ).toBeTruthy()
    // O texto aparece na faixa e no anúncio para leitor de tela: basta existir na faixa.
    expect(screen.getAllByText(panelCopy.teamViewBanner).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Somente leitura').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'AB-118 · Revisar integração' })).toBeNull()
  })

  it('a Equipe não tem arrastar, seletor de estado nem "+" nas colunas', async () => {
    const { user } = setup()
    await user.click(within(await scopeGroup()).getByRole('button', { name: 'Equipe' }))
    await screen.findByRole('button', { name: /AB-119 Relatório mensal/ })
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: /^Mover / })).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: /^Nova tarefa em/ })).toHaveLength(0)
  })

  it('respeita o filtro de projeto da barra lateral', async () => {
    const { user, listTeamBoard } = setup()
    await user.click(within(await scopeGroup()).getByRole('button', { name: 'Equipe' }))
    await screen.findByRole('button', { name: /AB-119 Relatório mensal/ })

    await user.click(screen.getByRole('button', { name: /Projeto Boreal/ }))

    await waitFor(() => expect(listTeamBoard).toHaveBeenLastCalledWith({ projectId: BOREAL }))
  })

  it('voltar para Minhas tarefas restaura o quadro pessoal e tira a faixa', async () => {
    const { user } = setup()
    const group = await scopeGroup()
    await user.click(within(group).getByRole('button', { name: 'Equipe' }))
    await screen.findByRole('button', { name: /AB-119 Relatório mensal/ })
    await user.click(within(group).getByRole('button', { name: 'Minhas' }))

    expect(await screen.findByRole('button', { name: 'AB-118 · Revisar integração' })).toBeTruthy()
    expect(screen.queryByText(panelCopy.teamViewBanner)).toBeNull()
  })

  it('anuncia a troca de visão numa região aria-live educada', async () => {
    const { user } = setup()
    const group = await scopeGroup()
    expect(liveRegionText()).toBe('')

    await user.click(within(group).getByRole('button', { name: 'Equipe' }))
    await waitFor(() => expect(liveRegionText()).toBe(panelCopy.teamViewAnnouncement))

    await user.click(within(group).getByRole('button', { name: 'Minhas' }))
    await waitFor(() => expect(liveRegionText()).toBe(panelCopy.myTasksAnnouncement))
  })
})

describe('visão Equipe na tela', () => {
  it('abrir um cartão da Equipe mostra o detalhe somente leitura, mesmo com edição permitida pelo servidor', async () => {
    const { user } = setup()
    await user.click(within(await scopeGroup()).getByRole('button', { name: 'Equipe' }))
    await user.click(await screen.findByRole('button', { name: /AB-119 Relatório mensal/ }))

    const title = await screen.findByRole('textbox', { name: panelCopy.taskTitle })
    expect((title as HTMLInputElement).disabled).toBe(true)
    expect(screen.getAllByText('Somente leitura').length).toBeGreaterThan(1)
    // Sem ação de bloqueio habilitada: ausente ou desabilitada.
    expect(
      screen.queryByRole('button', { name: /^Bloquear/ })?.hasAttribute('disabled') ?? true,
    ).toBe(true)
  })

  it('mostra o carregamento enquanto a Equipe chega', async () => {
    const { user } = setup({ team: new Promise<TaskDto[]>(() => undefined) })
    await user.click(within(await scopeGroup()).getByRole('button', { name: 'Equipe' }))
    expect(await screen.findByRole('status', { name: 'Carregando quadro' })).toBeTruthy()
  })

  it('mostra erro curto e "Tentar de novo" recarrega a Equipe', async () => {
    let attempts = 0
    const { user } = setup({
      team: () => {
        attempts += 1
        return attempts === 1 ? Promise.reject(new Error('falhou')) : Promise.resolve([teamTask])
      },
    })
    await user.click(within(await scopeGroup()).getByRole('button', { name: 'Equipe' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(panelCopy.teamError)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('button', { name: /AB-119 Relatório mensal/ })).toBeTruthy()
    expect(attempts).toBe(2)
  })

  it('mostra o vazio coerente quando a equipe não tem tarefas', async () => {
    const { user } = setup({ team: [] })
    await user.click(within(await scopeGroup()).getByRole('button', { name: 'Equipe' }))
    expect(await screen.findByText(panelCopy.teamEmpty)).toBeTruthy()
  })

  it('o gestor vê na Equipe as tarefas que o servidor devolve, somente leitura', async () => {
    const { user, listTeamBoard } = setup({ userId: MANAGER, mine: [] })
    await user.click(within(await scopeGroup()).getByRole('button', { name: 'Equipe' }))
    expect(listTeamBoard).toHaveBeenCalled()
    expect(
      await screen.findByRole('button', { name: /AB-119 Relatório mensal, .*somente leitura/ }),
    ).toBeTruthy()
  })

  it('filtros e medidor de WIP valem sobre as tarefas da Equipe', async () => {
    const { user } = setup({
      team: [
        makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5T01', {
          key: 'AB-119',
          title: 'Relatório mensal',
          status: 'in_progress',
          agingDays: 6,
        }),
        makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5T02', {
          key: 'AB-120',
          title: 'Revisão de contrato',
          status: 'in_progress',
        }),
      ],
      board: { wipLimits: { in_progress: 1 }, wipColumns: [] },
    })
    await user.click(within(await scopeGroup()).getByRole('button', { name: 'Equipe' }))

    expect(
      await screen.findByRole('img', { name: 'Desenvolvendo: 2 de 1, acima do limite' }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Paradas · 1' }))
    expect(screen.getByRole('button', { name: /AB-119 Relatório mensal/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /AB-120 Revisão de contrato/ })).toBeNull()
  })

  it('o editor de limite não aparece na Equipe', async () => {
    const { user } = setup({ userId: MANAGER, board: { wipLimits: {}, wipColumns: [] } })
    await user.click(within(await scopeGroup()).getByRole('button', { name: 'Equipe' }))
    await screen.findByRole('button', { name: /AB-119 Relatório mensal/ })
    expect(screen.queryByRole('button', { name: /Definir limite de/ })).toBeNull()
  })
})
