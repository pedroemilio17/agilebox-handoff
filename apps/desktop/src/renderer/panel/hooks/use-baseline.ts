import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Linha de base do projeto. Sem projeto selecionado, a consulta fica desligada. */
export function useBaseline(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.baseline.project(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.baseline.get({ projectId: projectId! }),
  })
}

/** Tirar a foto (só o gestor). A foto nova muda a comparação, então a leitura é recarregada. */
export function useTakeBaseline(projectId: string | null) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (projectId === null) return Promise.reject(new Error('Sem projeto selecionado'))
      return api.baseline.take({ projectId })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.baseline.all })
    },
  })
}
