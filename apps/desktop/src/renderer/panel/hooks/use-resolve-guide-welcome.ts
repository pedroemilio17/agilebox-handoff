import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Marca a janela de boas-vindas do projeto como respondida para a pessoa que leu. */
export function useResolveGuideWelcome() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => api.guide.resolveWelcome({ projectId }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: queryKeys.guide.all }),
  })
}
