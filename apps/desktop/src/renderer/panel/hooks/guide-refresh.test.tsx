import { cleanup, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { createFakeApi } from '../../shared/testing/fake-api'
import { refreshBacklogAndBoard } from '../backlog/use-backlog'
import { GUIDE_PROJECT_ID } from '../guide/guide-fixtures'
import { useSchedule } from './use-schedule'

afterEach(cleanup)

/** Quando uma ação conclui um passo do guia, a consulta do guia é lida de novo (o card avança). */
describe('atualização do guia depois de ações que concluem passos', () => {
  it('reordenar o backlog invalida o guia (passo "Ordene pela importância")', () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    refreshBacklogAndBoard(queryClient)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.guide.all })
  })

  it('abrir o cronograma invalida o guia (passo "Acompanhe pelo cronograma")', async () => {
    const api = createFakeApi()
    vi.spyOn(api.schedule, 'get').mockResolvedValue({
      projectId: GUIDE_PROJECT_ID,
    } as never)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    function Probe() {
      useSchedule(GUIDE_PROJECT_ID)
      return null
    }
    render(
      <ApiProvider api={api}>
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>
      </ApiProvider>,
    )
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.guide.all }))
  })
})
