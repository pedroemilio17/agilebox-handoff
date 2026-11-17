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
import { presetModules, teamToolsView } from '../shared/testing/team-tools-fixture'
import { makeGuide, WELCOME_AGIL } from './guide/guide-fixtures'
import { App } from './App'

/** Janela de boas-vindas dentro do painel: só com projeto escolhido, e "Ver a trilha" abre o cartão. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const DIALOG_NAME = 'Boas-vindas ao Projeto Aurora, Ana'

function renderApp(options: { firstStepsCard?: 'open' | 'collapsed' | 'hidden' } = {}) {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  installFlowApi(api, {
    role: 'collaborator',
    tools: teamToolsView({ modules: presetModules('scrum'), level: 'advanced' }),
    tasks: [FLOW_TASK],
  })
  const guide = vi.spyOn(api.guide, 'get').mockImplementation(({ projectId }) =>
    Promise.resolve(
      makeGuide({
        projectId,
        doneCount: 0,
        showWelcome: true,
        welcome: { ...WELCOME_AGIL, projectName: FLOW_PROJECT.name },
        firstStepsCard: options.firstStepsCard ?? 'collapsed',
      }),
    ),
  )
  const resolve = vi.spyOn(api.guide, 'resolveWelcome').mockResolvedValue(undefined)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { user: userEvent.setup(), guide, resolve }
}

async function selectProject(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(
    await screen.findByRole('button', {
      name: 'Projeto atual: Todos os projetos. Trocar de projeto',
    }),
  )
  await user.click(await screen.findByRole('option', { name }))
}

describe('App · janela de boas-vindas', () => {
  it('em "Todos os projetos" não aparece e nem consulta o guia', async () => {
    const { guide } = renderApp()
    await screen.findByRole('button', { name: /Trocar de projeto/ })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(guide).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: /Boas-vindas/ })).toBeNull()
  })

  it('com um projeto escolhido mostra a janela, com o primeiro nome da pessoa', async () => {
    const { user } = renderApp()
    await selectProject(user, FLOW_PROJECT.name)
    const dialog = await screen.findByRole('dialog', { name: DIALOG_NAME })
    expect(
      within(dialog).getByText('Este projeto começou como Ágil: 5 módulos ligados.'),
    ).not.toBeNull()
  })

  it('"Ver a trilha" grava a resposta e abre o cartão "Primeiros passos"', async () => {
    const { user, resolve } = renderApp({ firstStepsCard: 'collapsed' })
    await selectProject(user, FLOW_PROJECT.name)
    await user.click(await screen.findByRole('button', { name: 'Ver a trilha' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: DIALOG_NAME })).toBeNull())
    expect(resolve).toHaveBeenCalledWith({ projectId: FLOW_PROJECT.id })
    expect(await screen.findByRole('list', { name: 'Passos do projeto' })).not.toBeNull()
  })
})
