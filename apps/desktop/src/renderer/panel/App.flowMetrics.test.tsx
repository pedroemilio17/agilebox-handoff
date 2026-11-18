import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModuleId } from '@agilebox/core'
import { ApiProvider } from '../shared/api/ApiProvider'
import {
  createFakeApi,
  emptyFlowMetricsView,
  emptyScheduleView,
  emptyTrackingView,
  emptyWbsView,
} from '../shared/testing/fake-api'
import {
  FLOW_PROJECT,
  FLOW_TASK,
  installFlowApi,
  stubDesktopBridge,
} from '../shared/testing/flow-backend'
import { presetModules, teamToolsView } from '../shared/testing/team-tools-fixture'
import { projectModulesView } from '../shared/testing/project-modules-fixture'
import { App } from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderApp({
  enabled = ['flowMetrics'],
  level = 'advanced',
}: {
  readonly enabled?: readonly ModuleId[]
  readonly level?: 'basic' | 'advanced'
} = {}) {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  installFlowApi(api, {
    role: 'manager',
    tools: teamToolsView({ modules: presetModules('kanban'), level, role: 'manager' }),
    tasks: [FLOW_TASK],
  })
  vi.spyOn(api.projects, 'list').mockResolvedValue([FLOW_PROJECT])
  vi.spyOn(api.projectModules, 'get').mockImplementation(({ projectId }) =>
    Promise.resolve(
      projectModulesView({
        enabled: projectId === FLOW_PROJECT.id ? enabled : [],
        canManage: true,
        projectId,
      }),
    ),
  )
  vi.spyOn(api.projectModules, 'getOrganization').mockResolvedValue({
    modules: [],
    hasActiveProjects: false,
  })
  vi.spyOn(api.schedule, 'get').mockImplementation(({ projectId }) =>
    Promise.resolve(emptyScheduleView(projectId)),
  )
  vi.spyOn(api.tracking, 'get').mockImplementation(({ projectId }) =>
    Promise.resolve(emptyTrackingView(projectId)),
  )
  vi.spyOn(api.flowMetrics, 'get').mockImplementation(({ projectId }) =>
    Promise.resolve(emptyFlowMetricsView(projectId)),
  )
  vi.spyOn(api.wbs, 'get').mockResolvedValue({ ...emptyWbsView(FLOW_PROJECT.id), canEdit: true })
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

function railNav() {
  return screen.getByRole('navigation', { name: 'Navegação principal' })
}

function projectButton(name: string) {
  return within(railNav()).getByRole('button', { name: new RegExp(name) })
}

describe('item Métricas de fluxo na barra lateral', () => {
  it('aparece com o módulo ligado no projeto e leva à tela', async () => {
    const { user, api } = renderApp()
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(within(railNav()).queryByRole('button', { name: 'Métricas de fluxo' })).toBeNull()

    await user.click(projectButton(FLOW_PROJECT.name))
    await user.click(await within(railNav()).findByRole('button', { name: 'Métricas de fluxo' }))

    expect(await screen.findByRole('heading', { name: 'Métricas de fluxo', level: 2 })).toBeTruthy()
    expect(api.flowMetrics.get).toHaveBeenCalledWith({ projectId: FLOW_PROJECT.id })
  })

  it('o nível da pessoa não esconde a tela quando o módulo está ligado', async () => {
    const { user } = renderApp({ level: 'basic' })
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    await user.click(projectButton(FLOW_PROJECT.name))
    expect(await within(railNav()).findByRole('button', { name: 'Métricas de fluxo' })).toBeTruthy()
  })

  it('projeto sem o módulo não mostra o item', async () => {
    const { user } = renderApp({ enabled: [] })
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    await user.click(projectButton(FLOW_PROJECT.name))
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(within(railNav()).queryByRole('button', { name: 'Métricas de fluxo' })).toBeNull()
  })

  it('sem projeto selecionado não mostra o item', async () => {
    renderApp()
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(within(railNav()).queryByRole('button', { name: 'Métricas de fluxo' })).toBeNull()
  })
})
