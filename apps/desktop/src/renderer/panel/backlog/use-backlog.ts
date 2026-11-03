import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import type { BacklogPlacementInput } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { backlogKeys } from './query-keys'

/** Mudança de ordem ou de quadro mexe no backlog e no quadro: os dois são releitos. */
export function invalidateBacklog(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: backlogKeys.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  ])
}

export function useBacklogList() {
  const api = useApi()
  return useQuery({
    queryKey: backlogKeys.list,
    queryFn: () => api.backlog.list({}),
  })
}

/** Responsável e participantes de cada linha: o mesmo detalhe que o quadro já lê. */
export function useBacklogDetails(taskIds: readonly string[]) {
  const api = useApi()
  return useQueries({
    queries: taskIds.map((taskId) => ({
      queryKey: queryKeys.tasks.detail(taskId),
      queryFn: () => api.tasks.get({ taskId }),
    })),
  })
}

export function useReorderBacklog() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { taskId: string; placement: BacklogPlacementInput }) =>
      api.backlog.reorder(input),
    onSettled: () => invalidateBacklog(queryClient),
  })
}

export function useTakeToBoard() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { taskId: string }) => api.backlog.takeToBoard(input),
    onSettled: () => invalidateBacklog(queryClient),
  })
}
