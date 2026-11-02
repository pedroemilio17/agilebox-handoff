import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Nível do time e telas do menu para quem está logado (o servidor já aplica nível, módulos e papel). */
export function useTeamCapabilities() {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.teamModules.capabilities,
    queryFn: () => api.teamModules.get(),
  })
}
