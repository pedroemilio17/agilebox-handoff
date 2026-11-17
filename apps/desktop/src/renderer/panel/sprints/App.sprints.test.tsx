import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { presetModules, teamToolsView } from '../../shared/testing/team-tools-fixture'
import {
  FLOW_TASK_WITH_PLANNING,
  installFlowApi,
  stubDesktopBridge,
  toTaskDto,
} from '../../shared/testing/flow-backend'
import { renderPanel, settleCapabilities } from '../../shared/testing/render-panel'
import { TaskRow } from '../../tray/screens/TaskRow'
import { App } from '../App'
import { sprintCopy } from './sprint-copy'

/**
 * Integração no painel: item de menu, atalho G S, capacidades por preset e nível, filtro Sprint
 * ativa e o marcador "Sprint N" no card, no Backlog, no detalhe e na bandeja.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const KANBAN = presetModules('kanban')
const SCRUM = presetModules('scrum')
const SPRINT_ID = '01J8Y4G2XK8Z1S6M3Q9W0S004'

/** Cartão com a sprint aberta, como o servidor devolve com o módulo ligado. */
const IN_SPRINT = {
  ...FLOW_TASK_WITH_PLANNING,
  sprint: { id: SPRINT_ID, number: 4, name: 'Sprint 4', status: 'active' as const },
}

function renderApp(
  modules: readonly string[],
  level: 'basic' | 'intermediate' | 'advanced' = 'intermediate',
  setup: (api: ReturnType<typeof createFakeApi>) => void = () => undefined,
) {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  const tools = teamToolsView({
    modules: modules as never,
    level,
    role: 'manager',
  })
  installFlowApi(api, { role: 'manager', tools, tasks: [IN_SPRINT] })
  vi.spyOn(api.daily, 'listForDate').mockResolvedValue([])
  vi.spyOn(api.sprints, 'list').mockResolvedValue([])
  vi.spyOn(api.backlog, 'list').mockResolvedValue([])
  setup(api)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { api, user: userEvent.setup() }
}

const cardLabel = async () =>
  (await screen.findByRole('button', { name: /^AB-118 · / })).getAttribute('aria-label') ?? ''

describe('Sprints no menu e nos atalhos, por ferramenta e nível', () => {
  it('Kanban simples · Básico: sem item, sem atalho e sem filtro de sprint', async () => {
    const { user, api } = renderApp(KANBAN, 'basic')
    await settleCapabilities(api)
    expect(screen.queryByRole('button', { name: 'Sprints' })).toBeNull()
    await user.keyboard('gs')
    expect(screen.queryByRole('region', { name: sprintCopy.title })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Sprint ativa/ })).toBeNull()
    expect(await cardLabel()).not.toMatch(/Sprint/)
  })

  it('Scrum · Básico: sem tela de planejamento, mas o marcador "Sprint 4" no card', async () => {
    const { api } = renderApp(SCRUM, 'basic')
    await settleCapabilities(api)
    expect(screen.queryByRole('button', { name: 'Sprints' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Sprint ativa/ })).toBeNull()
    expect(await cardLabel()).toMatch(/Sprint 4/)
    expect(screen.getByText('Sprint 4')).toBeTruthy()
  })

  it('Scrum · Intermediário: item de menu, atalho G S e o filtro Sprint ativa', async () => {
    const { user } = renderApp(SCRUM, 'intermediate')
    await user.click(await screen.findByRole('button', { name: 'Sprints' }))
    expect(await screen.findByRole('region', { name: sprintCopy.title })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Quadro' }))
    await user.keyboard('gs')
    expect(await screen.findByRole('region', { name: sprintCopy.title })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Quadro' }))
    expect(await screen.findByRole('button', { name: /^Sprint ativa · 1$/ })).toBeTruthy()
  })

  it('o filtro Sprint ativa deixa só os cartões dessa sprint', async () => {
    const other: TaskDto = {
      ...toTaskDto(FLOW_TASK_WITH_PLANNING),
      id: '01J8Y4G2XK8Z1S6M3Q9W0BKZZ',
      key: 'AB-777',
      number: 777,
      title: 'Sem sprint',
      sprint: null,
    }
    const { user, api } = renderApp(SCRUM, 'intermediate', (api) => {
      vi.spyOn(api.tasks, 'listBoard').mockResolvedValue({
        tasks: [toTaskDto(IN_SPRINT), other],
        wipLimits: {},
        wipColumns: [],
      })
    })
    await settleCapabilities(api)
    await user.click(await screen.findByRole('button', { name: /^Sprint ativa · 1$/ }))
    expect(await screen.findByRole('button', { name: /^AB-118 · / })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^AB-777 · / })).toBeNull()
  })
})

describe('Marcador "Sprint N" nas superfícies', () => {
  it('no detalhe da tarefa, como propriedade passiva', async () => {
    const { user, api } = renderApp(SCRUM, 'basic')
    await settleCapabilities(api)
    await user.click(await screen.findByRole('button', { name: /^AB-118 · / }))
    const dialog = await screen.findByRole('dialog', { name: FLOW_TASK_WITH_PLANNING.title })
    const row = within(dialog).getByRole('group', { name: sprintCopy.sprintProperty })
    expect(within(row).getByText('Sprint 4')).toBeTruthy()
  })

  it('no Backlog, na linha do item', async () => {
    const { user, api } = renderApp(SCRUM, 'intermediate', (api) => {
      vi.spyOn(api.backlog, 'list').mockResolvedValue([
        toTaskDto({ ...IN_SPRINT, inBacklog: true }),
      ])
    })
    await settleCapabilities(api)
    await user.click(await screen.findByRole('button', { name: 'Backlog' }))
    expect(await screen.findByText('Sprint 4')).toBeTruthy()
  })

  it('na bandeja, na linha da tarefa', () => {
    const api = createFakeApi()
    vi.spyOn(api.teamTools, 'get').mockResolvedValue(
      teamToolsView({ modules: [...SCRUM], level: 'basic', role: 'manager' }),
    )
    renderPanel(
      <ul>
        <TaskRow
          task={toTaskDto(IN_SPRINT)}
          now={new Date('2026-11-16T12:00:00Z')}
          highlighted={false}
          onOpen={() => undefined}
        />
      </ul>,
      { api },
    )
    expect(screen.getByText(/Sprint 4/)).toBeTruthy()
  })

  it('nada aparece com o módulo desligado (DTO sem sprint)', async () => {
    const { api } = renderApp(KANBAN, 'advanced')
    await settleCapabilities(api)
    expect(await cardLabel()).not.toMatch(/Sprint/)
  })
})
