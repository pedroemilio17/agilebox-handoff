import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { presetModules, teamToolsView } from '../../shared/testing/team-tools-fixture'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import {
  previewOk,
  changeResult,
  FLOW_TASK_WITH_PLANNING,
  installFlowApi,
  stubDesktopBridge,
} from '../../shared/testing/flow-backend'
import { settleCapabilities } from '../../shared/testing/render-panel'
import { App } from '../App'

/**
 * Integração no painel: o item de menu, o atalho G B, os marcadores passivos no card e os campos do
 * detalhe seguem o nível e as ferramentas do time, como o backend devolve em `teamTools.get`.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const KANBAN = presetModules('kanban')
const SCRUM = presetModules('scrum')

function renderApp(
  tools: ReturnType<typeof teamToolsView>,
  setupApi: (api: ReturnType<typeof createFakeApi>) => void = () => undefined,
) {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  const flow = installFlowApi(api, {
    role: 'manager',
    tools,
    tasks: [FLOW_TASK_WITH_PLANNING],
  })
  vi.spyOn(api.backlog, 'list').mockResolvedValue([])
  vi.spyOn(api.daily, 'listForDate').mockResolvedValue([])
  setupApi(api)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { api, flow, user: userEvent.setup() }
}

async function openCard() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /^AB-118 · / }))
  return screen.findByRole('dialog', { name: FLOW_TASK_WITH_PLANNING.title })
}

describe('Backlog no menu e nos atalhos, por ferramenta e nível', () => {
  it('sem o módulo, não há item de menu nem tela, e G B não abre nada', async () => {
    const { user, api } = renderApp(
      teamToolsView({ modules: KANBAN, level: 'basic', role: 'manager' }),
    )
    await settleCapabilities(api)
    expect(screen.queryByRole('button', { name: 'Backlog' })).toBeNull()
    await user.keyboard('gb')
    expect(screen.queryByRole('region', { name: 'Backlog' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Quadro' })).toBeTruthy()
  })

  it('Scrum no Intermediário: item de menu, tela e atalho G B', async () => {
    const { user } = renderApp(
      teamToolsView({ modules: SCRUM, level: 'intermediate', role: 'manager' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Backlog' }))
    expect(await screen.findByRole('region', { name: 'Backlog' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Quadro' }))
    await user.keyboard('gb')
    expect(await screen.findByRole('region', { name: 'Backlog' })).toBeTruthy()
  })

  it('Scrum no Básico: sem item de menu e sem tela, mas o marcador de critérios no card segue', async () => {
    const { api } = renderApp(teamToolsView({ modules: SCRUM, level: 'basic', role: 'manager' }))
    await settleCapabilities(api)
    expect(screen.queryByRole('button', { name: 'Backlog' })).toBeNull()
    expect(await screen.findByRole('button', { name: /^AB-118 · .*1\/2 critérios/ })).toBeTruthy()
  })
})

describe('Critérios e estimativa no detalhe e no card, por nível', () => {
  it('Kanban simples · Básico: nada de critérios nem estimativa no card nem no detalhe', async () => {
    const { api } = renderApp(teamToolsView({ modules: KANBAN, level: 'basic', role: 'manager' }))
    const card = await screen.findByRole('button', { name: /^AB-118 · / })
    await settleCapabilities(api)
    expect(card.getAttribute('aria-label')).not.toMatch(/critérios|Estimativa/)
    const dialog = await openCard()
    expect(within(dialog).queryByRole('region', { name: 'Critérios de aceitação' })).toBeNull()
    expect(within(dialog).queryByRole('group', { name: 'Estimativa (h)' })).toBeNull()
  })

  it('Scrum · Intermediário: critérios e estimativa aparecem no card e no detalhe', async () => {
    renderApp(teamToolsView({ modules: SCRUM, level: 'intermediate', role: 'manager' }))
    const card = await screen.findByRole('button', { name: /^AB-118 · / })
    expect(card.getAttribute('aria-label')).toMatch(/1\/2 critérios/)
    expect(card.getAttribute('aria-label')).toMatch(/Estimativa 2 h/)
    const dialog = await openCard()
    expect(within(dialog).getByRole('region', { name: 'Critérios de aceitação' })).toBeTruthy()
    expect(within(dialog).getByRole('group', { name: 'Estimativa (h)' })).toBeTruthy()
  })
})

describe('Ligar Backlog pela tela de ferramentas', () => {
  it('o item de menu aparece na hora, sem recarregar o painel', async () => {
    const off = teamToolsView({ modules: KANBAN, level: 'intermediate', role: 'manager' })
    const on = teamToolsView({
      modules: [...KANBAN, 'backlog'],
      level: 'intermediate',
      role: 'manager',
    })
    const { user, flow } = renderApp(off, (api) => {
      vi.spyOn(api.teamTools, 'previewChange').mockResolvedValue(previewOk())
      vi.spyOn(api.teamTools, 'applyChange').mockImplementation(() => {
        flow.serve(on)
        return Promise.resolve(changeResult(on))
      })
    })
    await user.click(await screen.findByRole('button', { name: 'Ajustes' }))
    await user.click(await screen.findByRole('switch', { name: 'Ligar Backlog' }))
    if (screen.queryByRole('dialog')) {
      await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Backlog' })).toBeTruthy())
  })
})
