import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../shared/api/ApiProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import { teamToolsView } from '../shared/testing/team-tools-fixture'
import { App } from './App'

const updates = {
  check: () => Promise.resolve({ state: 'up-to-date', commit: 'x' }),
  apply: () => Promise.resolve({ state: 'ready' }),
  restart: () => Promise.resolve({ state: 'started' }),
  lastRun: () => Promise.resolve(null),
  info: () => Promise.resolve({ version: '0.2.0', mode: 'source' }),
  onProgress: () => () => undefined,
}

beforeEach(() => {
  // Ajustes também mostra Aparência e Atualizações, que leem a ponte do Electron.
  vi.stubGlobal('agilebox', { shell: { setAppearance: vi.fn() }, updates })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Ajustes abre as ferramentas da equipe', () => {
  it('o item Ajustes mostra a tela e não tem mais "Em breve"; Plug-ins segue em breve', async () => {
    const api = createFakeApi()
    vi.spyOn(api.projects, 'list').mockResolvedValue([])
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue({
      tasks: [],
      wipLimits: {},
      wipColumns: [],
    })
    vi.spyOn(api.teamTools, 'get').mockResolvedValue(
      teamToolsView({ modules: ['core', 'agenda'], level: 'basic', role: 'manager' }),
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ApiProvider api={api}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ApiProvider>,
    )

    const settings = await screen.findByRole('button', { name: 'Ajustes' })
    expect(settings.textContent).not.toContain('Em breve')
    await userEvent.setup().click(settings)

    expect(await screen.findByRole('heading', { name: 'Ferramentas da equipe' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Aparência' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Plug-ins, Em breve' })).toBeTruthy()
  })
})
