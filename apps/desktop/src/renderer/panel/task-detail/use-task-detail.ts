import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TaskUpdateInput } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

export function useTaskDetail(taskId: string) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => api.tasks.get({ taskId }),
  })
}

export function useUpdateTask(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: TaskUpdateInput['changes']) => api.tasks.update({ taskId, changes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
    },
  })
}

export function useMoveTaskStatus(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: Parameters<typeof api.tasks.move>[0]['status']) =>
      api.tasks.move({ taskId, status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
    },
  })
}
