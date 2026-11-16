import { useMemo, type ReactNode } from 'react'
import { buildCapabilities, CapabilitiesContext } from './capabilities-context'
import { useTeamTools } from './use-team-tools'

/** Provider do painel e da bandeja: as capacidades vêm de `teamTools.get`. */
export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const teamTools = useTeamTools()
  const loading = teamTools.isPending
  const modules = teamTools.data?.modules
  const value = useMemo(
    () =>
      buildCapabilities(
        teamTools.data?.capabilities,
        loading,
        (modules ?? [])
          .filter((module) => module.state === 'winding_down')
          .map((module) => module.id),
      ),
    [teamTools.data?.capabilities, loading, modules],
  )
  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>
}
