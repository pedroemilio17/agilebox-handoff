import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Projetos arquivados ficam de fora, a menos que a tela peça para mostrá-los. */
export function useProjects(includeArchived = false) {
  const api = useApi()
  return useQuery({
    queryKey: [...queryKeys.projects.list, includeArchived],
    queryFn: () => api.projects.list(includeArchived ? { includeArchived: true } : undefined),
  })
}
