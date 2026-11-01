import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

export function useProjects() {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.projects.list,
    queryFn: () => api.projects.list(),
  })
}
