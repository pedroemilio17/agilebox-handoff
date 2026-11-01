import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateTaskInput } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

export function useCreateTask() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.tasks.create(input),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  })
}
