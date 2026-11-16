import { useMemo, type ReactNode } from 'react'
import { buildCapabilities, CapabilitiesContext } from './capabilities-context'
import { useTeamTools } from './use-team-tools'

/** Provider do painel e da bandeja: as capacidades vêm de `teamTools.get`. */
export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const teamTools = useTeamTools()
  const loading = teamTools.isPending
  const value = useMemo(
    () => buildCapabilities(teamTools.data?.capabilities, loading),
    [teamTools.data?.capabilities, loading],
  )
  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>
}
