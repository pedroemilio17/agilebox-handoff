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
import type { ModuleId } from '@agilebox/core'
import { wbsView, deliverableRow, wbsId } from './wbs/wbs-fixtures'
import { App } from './App'

/** A barra mostra "Entregas" só com projeto selecionado e o módulo ligado nele (ADR-10). */

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
  wbsEnabled = ['wbs'],
  organization = { modules: [], hasActiveProjects: false },
}: {
  readonly wbsEnabled?: readonly ModuleId[]
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
        enabled: projectId === FLOW_PROJECT.id ? wbsEnabled : [],
        canManage: true,
        projectId,
      }),
    ),
  )
  vi.spyOn(api.projectModules, 'getOrganization').mockResolvedValue({
    modules: [...organization.modules],
    hasActiveProjects: organization.hasActiveProjects,
  })
  vi.spyOn(api.wbs, 'get').mockResolvedValue(
    wbsView([deliverableRow(wbsId('1'), { code: '1', title: 'Levantamento' })], { canEdit: true }),
  )
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

describe('item Entregas na barra lateral', () => {
  it('aparece com o módulo ligado no projeto selecionado e leva à tela', async () => {
    const { user, api } = renderApp()
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(within(railNav()).queryByRole('button', { name: 'Entregas (EAP)' })).toBeNull()

    await user.click(projectButton(FLOW_PROJECT.name))
    await user.click(await within(railNav()).findByRole('button', { name: 'Entregas (EAP)' }))

    expect(
      await screen.findByRole('table', { name: 'Estrutura de entregas e tarefas do projeto' }),
    ).toBeTruthy()
    expect(api.wbs.get).toHaveBeenCalledWith({ projectId: FLOW_PROJECT.id })
  })

  it('projeto sem o módulo não mostra o item', async () => {
    const { user } = renderApp({ wbsEnabled: [] })
    await screen.findByRole('region', { name: 'Concluído, tarefas' })

    await user.click(projectButton(FLOW_PROJECT.name))
    await screen.findByRole('region', { name: 'Concluído, tarefas' })

    expect(within(railNav()).queryByRole('button', { name: 'Entregas (EAP)' })).toBeNull()
  })

  it('sem projeto selecionado não mostra o item, mesmo com a organização ligando o módulo', async () => {
    renderApp({
      organization: {
        modules: [{ id: 'wbs', state: 'active' }],
        hasActiveProjects: true,
      },
    })
    await screen.findByRole('region', { name: 'Concluído, tarefas' })

    expect(within(railNav()).queryByRole('button', { name: 'Entregas (EAP)' })).toBeNull()
  })
})
