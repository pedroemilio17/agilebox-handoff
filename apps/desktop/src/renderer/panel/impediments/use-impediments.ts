import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { ListImpedimentsInput } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Impedimento muda a tarefa (estado bloqueado), o quadro, o detalhe, o dashboard, a linha do tempo e
 * a bandeja (que lê a lista de impedimentos). Por isso toda gravação invalida o conjunto.
 */
export function refreshImpedimentsEverywhere(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.impediments.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
}

export interface ImpedimentListFilters {
  readonly projectId?: string | undefined
  readonly ownerId?: string | undefined
  readonly includeResolved?: boolean | undefined
}

/** Lista de impedimentos. `enabled` falso não pede nada (ex.: usuário ainda não conhecido). */
export function useImpedimentList(filters: ImpedimentListFilters, enabled = true) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.impediments.list(filters),
    enabled,
    queryFn: () => {
      const input: ListImpedimentsInput = {
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
        ...(filters.includeResolved ? { includeResolved: true } : {}),
      }
      return api.impediments.list(input)
    },
  })
}

export function useAssignImpediment() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { readonly impedimentId: string; readonly ownerId: string | null }) =>
      api.impediments.assign(input),
    onSettled: () => refreshImpedimentsEverywhere(queryClient),
  })
}

export function useResolveImpediment() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { readonly impedimentId: string; readonly resolution: string | null }) =>
      api.impediments.resolve(input),
    onSettled: () => refreshImpedimentsEverywhere(queryClient),
  })
}
