import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
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
import { projectModulesView } from '../shared/testing/project-modules-fixture'
import { ALL_MODULES, teamToolsView } from '../shared/testing/team-tools-fixture'
import { makeGuide } from './guide/guide-fixtures'
import { App } from './App'

/** Guia nas telas do projeto: presença ao trocar de tela e a ponte para a tela do passo. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const HEADING = { name: 'Primeiros passos' }

function renderApp(options: {
  doneCount?: number
  firstStepsCard?: 'open' | 'collapsed'
  cardDismissed?: boolean
}) {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  installFlowApi(api, {
    role: 'collaborator',
    tools: teamToolsView({ modules: ALL_MODULES, level: 'advanced' }),
    tasks: [FLOW_TASK],
  })
  const guide = vi
    .spyOn(api.guide, 'get')
    .mockImplementation(({ projectId }) => Promise.resolve(makeGuide({ projectId, ...options })))
  vi.spyOn(api.guide, 'dismissCard').mockResolvedValue(undefined)
  // Módulos são do projeto: com todos ligados, as telas do fluxo aparecem na barra.
  vi.spyOn(api.projectModules, 'get').mockImplementation(({ projectId }) =>
    Promise.resolve(projectModulesView({ enabled: [...ALL_MODULES], canManage: true, projectId })),
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { user: userEvent.setup(), guide }
}

async function selectProject(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(
    await screen.findByRole('button', {
      name: 'Projeto atual: Todos os projetos. Trocar de projeto',
    }),
  )
  await user.click(await screen.findByRole('option', { name }))
}

/** Clica num item da barra lateral (o nome é o rótulo do item). */
async function goTo(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(await screen.findByRole('button', { name: label }))
}

describe('App · guia nas telas do projeto', () => {
  it('sem projeto escolhido, o cartão não aparece nem em outras telas', async () => {
    const { user, guide } = renderApp({ doneCount: 1 })
    await screen.findByRole('button', { name: /Trocar de projeto/ })
    await goTo(user, 'Backlog')
    await screen.findByRole('heading', { level: 1, name: 'Backlog' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(guide).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', HEADING)).toBeNull()
  })

  it('com projeto, o cartão segue nas telas do fluxo, pela barra lateral', async () => {
    const { user } = renderApp({ doneCount: 1 })
    await selectProject(user, FLOW_PROJECT.name)
    expect(await screen.findByRole('heading', HEADING)).not.toBeNull()
    for (const label of [
      'Backlog',
      'Sprints',
      'Entregas (EAP)',
      'Marcos',
      'Cronograma',
      'Burndown',
      'Riscos',
      'Módulos',
    ]) {
      await goTo(user, label)
      await waitFor(() => expect(screen.getByRole('heading', HEADING)).not.toBeNull())
    }
  })

  it('a ponte: "Abrir o backlog" no quadro leva ao backlog, e lá o cartão diz que o passo é ali', async () => {
    const { user } = renderApp({ doneCount: 1, firstStepsCard: 'open' })
    await selectProject(user, FLOW_PROJECT.name)
    const board = await screen.findByRole('list', { name: 'Passos do projeto' })
    expect(within(board).getByText('Ordene pela importância')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Abrir o backlog' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Backlog' })).not.toBeNull()
    expect(await screen.findByText('Você está na tela deste passo.')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Abrir o backlog' })).toBeNull()
  })

  it('fora do quadro, o cartão vem recolhido com o passo atual no cabeçalho', async () => {
    const { user } = renderApp({ doneCount: 2, firstStepsCard: 'open' })
    await selectProject(user, FLOW_PROJECT.name)
    await screen.findByRole('list', { name: 'Passos do projeto' })
    await goTo(user, 'Backlog')
    expect(await screen.findByRole('button', { name: 'Expandir' })).not.toBeNull()
    expect(screen.queryByRole('list', { name: 'Passos do projeto' })).toBeNull()
    expect(screen.getByText('Crie a primeira sprint')).not.toBeNull()
  })

  it('dispensado, o cartão não aparece em nenhuma tela do projeto', async () => {
    const { user } = renderApp({ doneCount: 1, cardDismissed: true })
    await selectProject(user, FLOW_PROJECT.name)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.queryByRole('heading', HEADING)).toBeNull()
    await goTo(user, 'Backlog')
    await screen.findByRole('heading', { level: 1, name: 'Backlog' })
    expect(screen.queryByRole('heading', HEADING)).toBeNull()
  })
})
