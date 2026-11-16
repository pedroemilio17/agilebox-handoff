import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api/ApiProvider'
import { queryKeys } from '../query/keys'

/** Ferramentas e capacidades mudam pouco; a lista volta a ser pedida no máximo a cada 30 s. */
export const TEAM_TOOLS_STALE_TIME_MS = 30_000

/**
 * Visão das ferramentas do time (`teamTools.get`): nível, módulos, presets e capacidades de quem
 * pede. Quando as ferramentas mudam, o pedido de gravação invalida `queryKeys.teamTools.all`.
 */
export function useTeamTools() {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.teamTools.view,
    queryFn: () => api.teamTools.get(),
    staleTime: TEAM_TOOLS_STALE_TIME_MS,
  })
}
