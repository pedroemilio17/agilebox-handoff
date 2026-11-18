import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Métricas de fluxo do projeto. Sem projeto selecionado, a consulta fica desligada. */
export function useFlowMetrics(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.flowMetrics.project(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.flowMetrics.get({ projectId: projectId! }),
  })
}
