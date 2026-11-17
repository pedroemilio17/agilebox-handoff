import type { ReactElement } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, vi } from 'vitest'
import type { AgileBoxApi, TeamToolsViewDto } from '@agilebox/contract'
import { ApiProvider } from '../api/ApiProvider'
import { CapabilitiesProvider } from '../capabilities/CapabilitiesProvider'
import { createFakeApi } from './fake-api'

/**
 * Monta um trecho do painel com os provedores reais (API, consultas e capacidades). Com `tools`, a
 * visão de ferramentas que `teamTools.get` devolve; sem ela, as capacidades ficam permissivas.
 */
export function renderPanel(
  ui: ReactElement,
  {
    api = createFakeApi(),
    tools,
  }: { readonly api?: AgileBoxApi; readonly tools?: TeamToolsViewDto } = {},
) {
  if (tools) vi.spyOn(api.teamTools, 'get').mockResolvedValue(tools)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <CapabilitiesProvider>{ui}</CapabilitiesProvider>
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { api, queryClient }
}

/**
 * Espera as capacidades assentarem. Sem isso, um teste que checa ausência pode rodar enquanto a
 * visão de ferramentas ainda carrega (o padrão é permissivo e mostraria tudo).
 */
export async function settleCapabilities(api: AgileBoxApi) {
  await waitFor(() => expect(api.teamTools.get).toHaveBeenCalled())
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
}
