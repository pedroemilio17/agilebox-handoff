import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Desarquiva um projeto. Quem pode é decidido pelo servidor (criador ou gestor): se recusar, o
 * erro chega à tela e nada é invalidado. Ao dar certo, atualiza as listas ativa e de arquivados
 * e as contagens das tarefas, que voltam a contar o projeto.
 */
export function useUnarchiveProject() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => api.projects.unarchiveProject({ projectId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.list }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.archived }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
      ])
    },
  })
}
