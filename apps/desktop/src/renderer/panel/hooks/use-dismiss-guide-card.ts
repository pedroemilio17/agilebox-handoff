import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Dispensa o cartão "Primeiros passos" neste projeto, para a pessoa que dispensou. */
export function useDismissGuideCard() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => api.guide.dismissCard({ projectId }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: queryKeys.guide.all }),
  })
}
