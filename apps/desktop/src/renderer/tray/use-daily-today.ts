import { useQuery } from '@tanstack/react-query'
import { useApi } from '../shared/api/ApiProvider'
import { queryKeys } from '../shared/query/keys'
import { todayDateOnly } from '../shared/lib/today'

/** A daily da pessoa de hoje (ou null) e se ela ainda é devida. Data local, enviada pelo renderer. */
export function useDailyToday() {
  const api = useApi()
  const date = todayDateOnly()
  return useQuery({
    queryKey: queryKeys.daily.today(date),
    queryFn: () => api.daily.getToday({ date }),
  })
}
