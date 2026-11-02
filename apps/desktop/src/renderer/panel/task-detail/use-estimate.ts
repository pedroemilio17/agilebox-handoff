import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Grava a estimativa em horas (M3.7). Nulo limpa. Não toca nas horas realizadas. */
export function useSetEstimate(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (estimatedHours: number | null) => api.estimates.set({ taskId, estimatedHours }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
    },
  })
}
