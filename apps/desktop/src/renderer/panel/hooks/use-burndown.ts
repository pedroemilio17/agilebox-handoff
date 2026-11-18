import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Burndown e velocidade do projeto. Sem projeto selecionado, a consulta fica desligada. */
export function useBurndown(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.burndown.project(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.burndown.get({ projectId: projectId! }),
  })
}
