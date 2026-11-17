import { useQuery } from '@tanstack/react-query'
import { useApi } from '../shared/api/ApiProvider'
import { queryKeys } from '../shared/query/keys'
import { clientTimeZone } from '../shared/lib/today'

/**
 * Sugestão do check-in a partir das tarefas movidas no dia (M5.1). Só consulta com `enabled`, que
 * quem chama liga só com a ferramenta de check-ins ativa e com a data já conhecida.
 */
export function useDailySuggestion(date: string, enabled: boolean) {
  const api = useApi()
  const timeZone = clientTimeZone()
  return useQuery({
    queryKey: queryKeys.daily.suggestion(date, timeZone),
    queryFn: () => api.daily.suggestSummary({ date, timeZone }),
    enabled: enabled && date !== '',
  })
}
