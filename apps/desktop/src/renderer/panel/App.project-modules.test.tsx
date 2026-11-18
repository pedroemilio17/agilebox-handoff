import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDto } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import {
  FLOW_PROJECT,
  FLOW_TASK,
  installFlowApi,
  stubDesktopBridge,
} from '../shared/testing/flow-backend'
import { presetModules, teamToolsView } from '../shared/testing/team-tools-fixture'
import { projectModulesView } from '../shared/testing/project-modules-fixture'
import { App } from './App'

/**
 * A barra segue os módulos do projeto selecionado, não os da equipe (ADR-10). A equipe aqui está no
 * Kanban simples, sem Sprints nem Backlog: quem decide são os módulos de cada projeto.
 */

const OTHER_PROJECT: ProjectDto = {
  ...FLOW_PROJECT,
  id: '01J8Y4G2XK8Z1S6M3Q9W0FGHKM',
  name: 'Projeto Beta',
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderApp({
  organization = { modules: [], hasActiveProjects: false },
}: {
  readonly organization?: {
    readonly modules: readonly {
      readonly id: string
      readonly state: 'active' | 'winding_down' | 'disabled'
    }[]
    readonly hasActiveProjects: boolean
  }
} = {}) {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  installFlowApi(api, {
    role: 'manager',
    tools: teamToolsView({ modules: presetModules('kanban'), level: 'advanced', role: 'manager' }),
    tasks: [FLOW_TASK],
  })
  vi.spyOn(api.projects, 'list').mockResolvedValue([FLOW_PROJECT, OTHER_PROJECT])
  vi.spyOn(api.projectModules, 'get').mockImplementation(({ projectId }) =>
    Promise.resolve(
      projectModulesView({
        enabled: projectId === FLOW_PROJECT.id ? ['sprints', 'backlog'] : [],
        canManage: true,
        projectId,
      }),
    ),
  )
  vi.spyOn(api.projectModules, 'getOrganization').mockResolvedValue({
    modules: [...organization.modules],
    hasActiveProjects: organization.hasActiveProjects,
  })
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

describe('barra lateral pelo módulo do projeto selecionado', () => {
  it('projeto que liga Sprints e Backlog mostra os dois, mesmo com a equipe no Kanban', async () => {
    const { user } = renderApp()
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(within(railNav()).queryByRole('button', { name: 'Sprints' })).toBeNull()

    await user.click(projectButton(FLOW_PROJECT.name))

    expect(await within(railNav()).findByRole('button', { name: 'Sprints' })).toBeTruthy()
    expect(within(railNav()).getByRole('button', { name: 'Backlog' })).toBeTruthy()
  })

  it('projeto sem o módulo não mostra o item, mesmo com a equipe no Kanban', async () => {
    const { user } = renderApp()
    await screen.findByRole('region', { name: 'Concluído, tarefas' })

    await user.click(projectButton(OTHER_PROJECT.name))

    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(within(railNav()).queryByRole('button', { name: 'Sprints' })).toBeNull()
    expect(within(railNav()).queryByRole('button', { name: 'Backlog' })).toBeNull()
  })

  it('trocar de projeto troca a barra', async () => {
    const { user } = renderApp()
    await screen.findByRole('region', { name: 'Concluído, tarefas' })

    await user.click(projectButton(FLOW_PROJECT.name))
    expect(await within(railNav()).findByRole('button', { name: 'Sprints' })).toBeTruthy()

    await user.click(projectButton(OTHER_PROJECT.name))
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(within(railNav()).queryByRole('button', { name: 'Sprints' })).toBeNull()

    await user.click(projectButton(FLOW_PROJECT.name))
    expect(await within(railNav()).findByRole('button', { name: 'Sprints' })).toBeTruthy()
  })

  it('sem projeto selecionado, vale a organização: Sprints aparece se algum projeto ativo liga', async () => {
    renderApp({
      organization: {
        modules: [
          { id: 'sprints', state: 'active' },
          { id: 'backlog', state: 'active' },
        ],
        hasActiveProjects: true,
      },
    })

    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(await within(railNav()).findByRole('button', { name: 'Sprints' })).toBeTruthy()
  })

  it('sem projeto ativo na organização, a barra cai na equipe (Kanban: sem Sprints)', async () => {
    renderApp({ organization: { modules: [], hasActiveProjects: false } })

    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(within(railNav()).queryByRole('button', { name: 'Sprints' })).toBeNull()
  })
})
