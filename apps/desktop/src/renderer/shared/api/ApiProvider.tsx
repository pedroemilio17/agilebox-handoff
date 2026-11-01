import { createContext, useContext, type ReactNode } from 'react'
import type { AgileBoxApi } from '@agilebox/contract'

const ApiContext = createContext<AgileBoxApi | null>(null)

export function ApiProvider({ api, children }: { api: AgileBoxApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
}

export function useApi(): AgileBoxApi {
  const api = useContext(ApiContext)
  if (!api) throw new Error('ApiProvider não encontrado')
  return api
}
