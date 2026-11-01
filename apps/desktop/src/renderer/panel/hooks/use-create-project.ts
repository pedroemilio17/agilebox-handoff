import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

export function useCreateProject() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.projects.create({ name }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.list }),
  })
}
