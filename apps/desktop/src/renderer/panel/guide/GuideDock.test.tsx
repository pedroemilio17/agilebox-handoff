import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import type { PanelView } from '../layout/PanelShell'
import { GuideDock } from './GuideDock'
import { GUIDE_PROJECT_ID, makeGuide } from './guide-fixtures'

afterEach(cleanup)

const HEADING = 'Primeiros passos'

function renderDock(
  view: PanelView,
  options: Omit<NonNullable<Parameters<typeof makeGuide>[0]>, 'projectId'> & {
    projectId?: string | null
  } = {},
) {
  const api = createFakeApi()
  const { projectId = GUIDE_PROJECT_ID, ...guideOptions } = options
  const get = vi
    .spyOn(api.guide, 'get')
    .mockResolvedValue(makeGuide({ doneCount: 1, ...guideOptions }))
  vi.spyOn(api.guide, 'dismissCard').mockResolvedValue(undefined)
  renderPanel(<GuideDock projectId={projectId} view={view} onNavigate={vi.fn()} />, { api })
  return { get }
}

describe('GuideDock · presença nas telas do projeto', () => {
  const screens: readonly PanelView[] = [
    'projects',
    'backlog',
    'sprints',
    'wbs',
    'milestones',
    'schedule',
    'tracking',
    'baseline',
    'burndown',
    'flowMetrics',
    'risks',
    'modules',
  ]

  it.each(screens)('aparece na tela "%s" com o projeto selecionado', async (view) => {
    renderDock(view)
    expect(await screen.findByRole('heading', { name: HEADING })).not.toBeNull()
  })

  it('a agenda mostra o cartão enquanto a planning está pendente', async () => {
    renderDock('agenda', { doneCount: 1 })
    expect(await screen.findByRole('heading', { name: HEADING })).not.toBeNull()
  })

  it('a agenda não mostra o cartão quando a planning já está feita', async () => {
    const { get } = renderDock('agenda', { doneCount: 7 })
    await waitFor(() => expect(get).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.queryByRole('heading', { name: HEADING })).toBeNull()
  })

  it.each(['dashboard', 'settings', 'plugins', 'impediments'] as const)(
    'não aparece na tela "%s"',
    async (view) => {
      const { get } = renderDock(view)
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(get).not.toHaveBeenCalled()
      expect(screen.queryByRole('heading', { name: HEADING })).toBeNull()
    },
  )

  it('sem projeto selecionado não aparece em tela nenhuma e não consulta o guia', async () => {
    const { get } = renderDock('backlog', { projectId: null })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(get).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: HEADING })).toBeNull()
  })

  it('dispensado, não aparece em tela nenhuma', async () => {
    const { get } = renderDock('backlog', { cardDismissed: true })
    await waitFor(() => expect(get).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.queryByRole('heading', { name: HEADING })).toBeNull()
  })

  it('com a intensidade hidden (experiência "sempre"), não aparece', async () => {
    const { get } = renderDock('backlog', { firstStepsCard: 'hidden' })
    await waitFor(() => expect(get).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.queryByRole('heading', { name: HEADING })).toBeNull()
  })

  it('ao trocar de tela, o cartão reabre conforme o passo atual daquela tela', async () => {
    const api = createFakeApi()
    vi.spyOn(api.guide, 'get').mockResolvedValue(makeGuide({ doneCount: 1 }))
    vi.spyOn(api.guide, 'dismissCard').mockResolvedValue(undefined)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = (view: PanelView) => (
      <ApiProvider api={api}>
        <QueryClientProvider client={queryClient}>
          <GuideDock projectId={GUIDE_PROJECT_ID} view={view} onNavigate={vi.fn()} />
        </QueryClientProvider>
      </ApiProvider>
    )
    const { rerender } = render(tree('sprints'))
    // Em Sprints o passo atual (backlog) não se realiza aqui: vem recolhido.
    expect(await screen.findByRole('button', { name: 'Expandir' })).not.toBeNull()
    expect(screen.queryByRole('list', { name: 'Passos do projeto' })).toBeNull()
    rerender(tree('backlog'))
    expect(await screen.findByRole('list', { name: 'Passos do projeto' })).not.toBeNull()
  })
})
