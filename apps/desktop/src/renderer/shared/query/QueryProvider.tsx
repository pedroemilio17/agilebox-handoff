import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApi } from '../api/ApiProvider'
import { createChangeSync } from './sync-changes'

export function QueryProvider({ children }: { children: ReactNode }) {
  const api = useApi()
  const [queryClient] = useState(() => new QueryClient())

  useEffect(
    () => createChangeSync(queryClient, (callback) => api.onChanges(callback)),
    [api, queryClient],
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
