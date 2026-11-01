import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

export function useSessionUsers() {
  const api = useApi()
  return useQuery({ queryKey: queryKeys.session.users, queryFn: () => api.session.listUsers() })
}
