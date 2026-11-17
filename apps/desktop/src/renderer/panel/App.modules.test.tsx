import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

/** "Módulos" na barra lateral: só com projeto selecionado, e para qualquer pessoa (leitura para o colaborador). */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderApp() {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  installFlowApi(api, {
    role: 'collaborator',
    tools: teamToolsView({ modules: presetModules('scrum'), level: 'advanced' }),
    tasks: [FLOW_TASK],
  })
  vi.spyOn(api.projectModules, 'get').mockResolvedValue(
    projectModulesView({ enabled: ['backlog'], canManage: false, projectId: FLOW_PROJECT.id }),
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

describe('Módulos na navegação', () => {
  it('sem projeto selecionado, o item não aparece', async () => {
    renderApp()
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(within(railNav()).queryByRole('button', { name: 'Módulos' })).toBeNull()
  })

  it('com projeto selecionado, o colaborador abre a tela em leitura', async () => {
    const { api, user } = renderApp()
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    await user.click(within(railNav()).getByRole('button', { name: new RegExp(FLOW_PROJECT.name) }))

    await user.click(await within(railNav()).findByRole('button', { name: 'Módulos' }))
    const region = await screen.findByRole('region', { name: 'Módulos' })
    expect(api.projectModules.get).toHaveBeenCalledWith({ projectId: FLOW_PROJECT.id })
    expect(within(region).getByRole('note').textContent).toContain(
      'Só o gestor muda os módulos do projeto.',
    )
    expect(
      within(region).getByRole<HTMLButtonElement>('switch', { name: 'Desligar Backlog' }).disabled,
    ).toBe(true)
  })
})
