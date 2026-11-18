import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Acompanhamento do projeto. Sem projeto selecionado, a consulta fica desligada. */
export function useTracking(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.tracking.project(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.tracking.get({ projectId: projectId! }),
  })
}
