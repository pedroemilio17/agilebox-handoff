import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { addDays } from '@agilebox/core'
import type { SprintDto, TaskDto, TrackingViewDto } from '@agilebox/contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import {
  CapabilitiesContext,
  type Capabilities,
} from '../../shared/capabilities/capabilities-context'
import { createFakeApi, emptyTrackingView } from '../../shared/testing/fake-api'
import { todayDateOnly } from '../../shared/lib/today'
import type { PanelView } from '../layout/PanelShell'
import { ProjectHomeView } from './ProjectHomeView'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5PJ'
const SPRINT_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5SP'
const ANA_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5V0'
const TODAY = todayDateOnly()

function taskDto(overrides: Partial<TaskDto> & Pick<TaskDto, 'id' | 'key' | 'status'>): TaskDto {
  const number = Number(overrides.key.split('-')[1])
  return {
    number,
    projectId: PROJECT_ID,
    projectName: 'Projeto Aurora',
    title: `Tarefa ${overrides.key}`,
    description: '',
    priority: 'normal',
    blockedReason: null,
    blockedAt: null,
    deadline: null,
    ticketId: null,
    ticketUrl: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    checklistProgress: { done: 0, total: 0, percent: 0 },
    commentCount: 0,
    ...overrides,
  }
}

const TASKS: TaskDto[] = [
  taskDto({ id: '01J8Y4G2XK8Z1S6M3Q9W0A5T1', key: 'AB-1', status: 'done' }),
  taskDto({ id: '01J8Y4G2XK8Z1S6M3Q9W0A5T2', key: 'AB-2', status: 'done' }),
  taskDto({ id: '01J8Y4G2XK8Z1S6M3Q9W0A5T3', key: 'AB-3', status: 'todo' }),
  taskDto({
    id: '01J8Y4G2XK8Z1S6M3Q9W0A5T4',
    key: 'AB-8',
    status: 'in_progress',
    blockedAt: new Date().toISOString(),
    blockedReason: 'aguardando homologação',
  }),
]

const ACTIVE_SPRINT: SprintDto = {
  id: SPRINT_ID,
  projectId: PROJECT_ID,
  number: 14,
  label: 'Sprint 14',
  name: 'Sprint 14',
  goal: null,
  plannedStart: addDays(TODAY, -6),
  plannedEnd: addDays(TODAY, 4),
  status: 'active',
  startedAt: null,
  closedAt: null,
  closePolicy: null,
  createdBy: ANA_ID,
  createdAt: '2026-11-01T10:00:00.000Z',
}

function capabilitiesWith(modules: readonly string[]): Capabilities {
  const set = new Set(modules)
  return {
    known: true,
    loading: false,
    can: () => true,
    showScreen: (moduleId) => moduleId === 'core' || set.has(moduleId),
    canFetch: () => true,
    isWindingDown: () => false,
  }
}

const ALL_MODULES = ['backlog', 'sprints', 'milestones', 'flowMetrics', 'agenda', 'cost']

function trackingWith(overrides: Partial<TrackingViewDto['summary']>, extra = {}): TrackingViewDto {
  const base = emptyTrackingView(PROJECT_ID)
  return {
    ...base,
    ...extra,
    summary: { ...base.summary, ...overrides },
  }
}

function renderHome({
  tasks = TASKS,
  tracking = trackingWith({ realizedCost: 9840, plannedCost: null }),
  modules = ALL_MODULES,
  newTaskBlockedReason,
  onNavigate = vi.fn<(view: PanelView) => void>(),
  onOpenTask = vi.fn(),
  onNewTask = vi.fn(),
  setup,
}: {
  readonly tasks?: TaskDto[]
  readonly tracking?: TrackingViewDto
  readonly modules?: readonly string[]
  readonly newTaskBlockedReason?: string | undefined
  readonly onNavigate?: (view: PanelView) => void
  readonly onOpenTask?: (id: string) => void
  readonly onNewTask?: () => void
  readonly setup?: (api: ReturnType<typeof createFakeApi>) => void
} = {}) {
  const api = createFakeApi()
  vi.spyOn(api.tasks, 'listBoard').mockResolvedValue({
    tasks,
    wipLimits: {},
    wipColumns: [],
  })
  vi.spyOn(api.tracking, 'get').mockResolvedValue(tracking)
  vi.spyOn(api.sprints, 'list').mockResolvedValue([ACTIVE_SPRINT])
  vi.spyOn(api.flowMetrics, 'get').mockResolvedValue({
    projectId: PROJECT_ID,
    today: TODAY,
    windowStart: addDays(TODAY, -14),
    windowEnd: addDays(TODAY, 1),
    leadDays: 4.8,
    cycleDays: 2.1,
    completed: 2,
    weeks: [],
  })
  vi.spyOn(api.projects, 'listMembers').mockResolvedValue([
    { id: ANA_ID, name: 'Ana Silva', initials: 'AS', role: 'collaborator' },
  ])
  setup?.(api)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <CapabilitiesContext.Provider value={capabilitiesWith(modules)}>
          <ProjectHomeView
            projectId={PROJECT_ID}
            projectName="Projeto Aurora"
            onNavigate={onNavigate}
            onOpenTask={onOpenTask}
            onNewTask={onNewTask}
            newTaskBlockedReason={newTaskBlockedReason}
          />
        </CapabilitiesContext.Provider>
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { user: userEvent.setup(), onNavigate, onOpenTask, onNewTask }
}

describe('Início do projeto', () => {
  it('mostra o nome do projeto e o andamento pelas tarefas concluídas', async () => {
    renderHome()
    expect(await screen.findByRole('heading', { level: 1, name: 'Projeto Aurora' })).toBeTruthy()
    const kpis = screen.getByRole('region', { name: 'Resumo do projeto' })
    expect(within(kpis).getByText('50%')).toBeTruthy()
    expect(within(kpis).getByText('2 de 4 concluídas')).toBeTruthy()
  })

  it('mostra tempo médio, sprint ativa e próximo marco quando os módulos estão ligados', async () => {
    const tracking = trackingWith(
      { realizedCost: 9840, plannedCost: null },
      {
        nextMilestone: {
          id: '01J8Y4G2XK8Z1S6M3Q9W0A5MB',
          title: 'Beta',
          dueOn: addDays(TODAY, 3),
          daysLeft: 3,
          status: 'on_track',
        },
      },
    )
    renderHome({ tracking })
    const kpis = await screen.findByRole('region', { name: 'Resumo do projeto' })
    await waitFor(() => {
      expect(within(kpis).getByText('4,8 dias')).toBeTruthy()
      expect(within(kpis).getByText('Sprint 14')).toBeTruthy()
      expect(within(kpis).getByText('Restam 4 dias')).toBeTruthy()
      expect(within(kpis).getByText('Beta')).toBeTruthy()
    })
  })

  it('oculta os cartões de módulos desligados', async () => {
    renderHome({ modules: ['backlog'] })
    const kpis = await screen.findByRole('region', { name: 'Resumo do projeto' })
    expect(within(kpis).queryByText('Sprint ativa')).toBeNull()
    expect(within(kpis).queryByText('Próximo marco')).toBeNull()
    expect(within(kpis).queryByText('Tempo médio')).toBeNull()
  })

  it('não mostra custo ao colaborador, que chega sem valor do servidor', async () => {
    renderHome({ tracking: trackingWith({ realizedCost: null, plannedCost: null }) })
    // "Próximo marco" só aparece com o acompanhamento carregado: o teste não passa antes da resposta.
    await screen.findByText('Próximo marco')
    expect(screen.queryByText('Custo acumulado')).toBeNull()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('mostra o custo acumulado ao gestor quando o módulo de custo está ligado', async () => {
    renderHome({ tracking: trackingWith({ realizedCost: 9840, plannedCost: null }) })
    const kpis = await screen.findByRole('region', { name: 'Resumo do projeto' })
    await waitFor(() => {
      expect(within(kpis).getByText('Custo acumulado')).toBeTruthy()
      expect(within(kpis).getByText(/R\$\s?9\.840,00/)).toBeTruthy()
    })
  })

  it('lista as tarefas por estado e leva ao Quadro', async () => {
    const { user, onNavigate } = renderHome()
    const states = await screen.findByRole('region', { name: 'Tarefas por estado' })
    const done = within(states).getByRole('button', { name: /Concluído, 2 tarefas/ })
    await user.click(done)
    expect(onNavigate).toHaveBeenCalledWith('projects')
    expect(within(states).getByRole('button', { name: /Planejamento, 0 tarefas/ })).toBeTruthy()
  })

  it('mostra bloqueios com o motivo e abre a tarefa ao clicar', async () => {
    const { user, onOpenTask } = renderHome()
    const attention = await screen.findByRole('region', { name: 'Precisa de atenção' })
    expect(within(attention).getByText('AB-8 bloqueada hoje')).toBeTruthy()
    expect(within(attention).getByText('aguardando homologação')).toBeTruthy()
    await user.click(within(attention).getByRole('button', { name: /AB-8 bloqueada hoje/ }))
    expect(onOpenTask).toHaveBeenCalledWith('01J8Y4G2XK8Z1S6M3Q9W0A5T4')
  })

  it('diz quando nada pede atenção', async () => {
    renderHome({
      tasks: [taskDto({ id: '01J8Y4G2XK8Z1S6M3Q9W0A5T9', key: 'AB-9', status: 'todo' })],
    })
    const attention = await screen.findByRole('region', { name: 'Precisa de atenção' })
    expect(within(attention).getByText('Nenhum bloqueio ativo no momento')).toBeTruthy()
    expect(within(attention).getByText('Nada pede atenção agora.')).toBeTruthy()
  })

  it('mostra em destaque as tarefas abertas e abre a tarefa', async () => {
    const { user, onOpenTask } = renderHome()
    const highlights = await screen.findByRole('region', { name: 'Em destaque neste projeto' })
    expect(within(highlights).queryByText('Tarefa AB-1')).toBeNull()
    await user.click(within(highlights).getByRole('button', { name: /Tarefa AB-8/ }))
    expect(onOpenTask).toHaveBeenCalledWith('01J8Y4G2XK8Z1S6M3Q9W0A5T4')
  })

  it('mostra o time do projeto e deixa pessoas externas como pendência honesta e compromissos vazios', async () => {
    renderHome()
    const team = await screen.findByRole('region', { name: 'Time do projeto' })
    expect(within(team).getByText('Ana Silva')).toBeTruthy()
    expect(within(team).getByText('Colaborador')).toBeTruthy()
    expect(screen.getByText('Pessoas externas ainda não aparecem nesta tela.')).toBeTruthy()
    expect(screen.getByText('Nenhum compromisso marcado pela frente.')).toBeTruthy()
  })

  it('desabilita Nova tarefa quando o projeto está arquivado', async () => {
    renderHome({ newTaskBlockedReason: 'Projeto arquivado: não recebe tarefa nova' })
    const button = await screen.findByRole('button', { name: '+ Nova tarefa' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('abre Nova tarefa e Ir ao Quadro pelos botões do cabeçalho', async () => {
    const { user, onNavigate, onNewTask } = renderHome()
    await user.click(await screen.findByRole('button', { name: '+ Nova tarefa' }))
    expect(onNewTask).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Ir ao Quadro' }))
    expect(onNavigate).toHaveBeenCalledWith('projects')
  })

  it('mostra erro com nova tentativa quando o quadro não carrega', async () => {
    const { user } = renderHome({
      setup: (api) => {
        vi.spyOn(api.tasks, 'listBoard').mockRejectedValueOnce(new Error('falha'))
      },
    })
    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByText('Não foi possível carregar o início deste projeto.'),
    ).toBeTruthy()
    await user.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Projeto Aurora' })).toBeTruthy()
  })

  it('pede para escolher um projeto quando não há nenhum selecionado', () => {
    const api = createFakeApi()
    const queryClient = new QueryClient()
    render(
      <ApiProvider api={api}>
        <QueryClientProvider client={queryClient}>
          <CapabilitiesContext.Provider value={capabilitiesWith(ALL_MODULES)}>
            <ProjectHomeView projectId={null} projectName={null} />
          </CapabilitiesContext.Provider>
        </QueryClientProvider>
      </ApiProvider>,
    )
    expect(screen.getByText('Escolha um projeto para ver o início.')).toBeTruthy()
  })
})
