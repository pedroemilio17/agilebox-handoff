import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { GuideCard } from './GuideCard'
import { GUIDE_PROJECT_ID, makeGuide } from './guide-fixtures'

afterEach(cleanup)

/** Monta o cartão com o contador de pedidos, e devolve como trocar o contador. */
function setup(options: Parameters<typeof makeGuide>[0]) {
  const api = createFakeApi()
  vi.spyOn(api.guide, 'get').mockResolvedValue(makeGuide(options))
  vi.spyOn(api.guide, 'dismissCard').mockResolvedValue(undefined)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = (openRequest: number) => (
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <GuideCard projectId={GUIDE_PROJECT_ID} onNavigate={vi.fn()} openRequest={openRequest} />
      </QueryClientProvider>
    </ApiProvider>
  )
  const view = render(tree(0))
  return { api, requestOpen: (count: number) => view.rerender(tree(count)) }
}

describe('GuideCard · pedido para abrir (openRequest)', () => {
  it('um pedido novo abre o cartão recolhido', async () => {
    const { requestOpen } = setup({ firstStepsCard: 'collapsed' })
    expect(await screen.findByRole('heading', { name: 'Primeiros passos' })).not.toBeNull()
    expect(screen.queryByRole('list', { name: 'Passos do projeto' })).toBeNull()
    requestOpen(1)
    expect(await screen.findByRole('list', { name: 'Passos do projeto' })).not.toBeNull()
  })

  it('um pedido anterior à montagem não abre o cartão', async () => {
    const api = createFakeApi()
    vi.spyOn(api.guide, 'get').mockResolvedValue(makeGuide({ firstStepsCard: 'collapsed' }))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ApiProvider api={api}>
        <QueryClientProvider client={queryClient}>
          <GuideCard projectId={GUIDE_PROJECT_ID} onNavigate={vi.fn()} openRequest={3} />
        </QueryClientProvider>
      </ApiProvider>,
    )
    expect(await screen.findByRole('heading', { name: 'Primeiros passos' })).not.toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.queryByRole('list', { name: 'Passos do projeto' })).toBeNull()
  })

  it('um cartão dispensado nesta sessão não volta com o pedido', async () => {
    const user = userEvent.setup()
    const { requestOpen } = setup({ doneCount: 1, firstStepsCard: 'collapsed' })
    await user.click(await screen.findByRole('button', { name: 'Dispensar' }))
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Primeiros passos' })).toBeNull(),
    )
    requestOpen(1)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.queryByRole('heading', { name: 'Primeiros passos' })).toBeNull()
  })
})
