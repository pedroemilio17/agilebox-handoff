import { useMemo, type ReactNode } from 'react'
import type { ExperienceLevel, ModuleState } from '@agilebox/core'
import { useProjectModules } from '../../panel/hooks/use-project-modules'
import {
  ALLOW_ALL,
  buildCapabilities,
  CapabilitiesContext,
  moduleStatesOf,
  type ModuleScope,
} from './capabilities-context'
import { useOrganizationModules } from './use-organization-modules'
import { useTeamTools } from './use-team-tools'

interface CapabilitiesProviderProps {
  readonly children: ReactNode
  /**
   * Projeto selecionado no painel. Com ele, os módulos valem para esse projeto. Sem ele (início,
   * "Todos os projetos" e a bandeja), valem os da organização; sem projeto ativo, os da equipe.
   */
  readonly selectedProjectId?: string | null
}

/** Escopo de módulos com o nível da equipe. Sem nível conhecido, a leitura cai na equipe. */
function scopeOf(
  modules: readonly { readonly id: string; readonly state: ModuleState }[],
  level: ExperienceLevel | undefined,
): ModuleScope | undefined {
  if (level === undefined) return undefined
  return { modules: moduleStatesOf(modules), level }
}

/**
 * Provider do painel e da bandeja. Ferramentas que não são de módulo seguem `teamTools.get`; a
 * visibilidade de módulo segue o projeto selecionado, ou a organização quando não há projeto (ADR-10).
 */
export function CapabilitiesProvider({
  children,
  selectedProjectId = null,
}: CapabilitiesProviderProps) {
  const teamTools = useTeamTools()
  const organization = useOrganizationModules(selectedProjectId === null)
  const project = useProjectModules(selectedProjectId)
  const teamLoading = teamTools.isPending
  const teamGranted = teamTools.data?.capabilities
  const teamWindingDown = useMemo(
    () =>
      (teamTools.data?.modules ?? [])
        .filter((module) => module.state === 'winding_down')
        .map((module) => module.id),
    [teamTools.data?.modules],
  )
  const level = teamTools.data?.level
  const projectModules = project.data?.modules
  const organizationData = organization.data

  const value = useMemo(() => {
    if (selectedProjectId !== null) {
      if (project.isError) return ALLOW_ALL
      if (projectModules === undefined) return buildCapabilities(undefined, true)
      return buildCapabilities(teamGranted, teamLoading, [], scopeOf(projectModules, level))
    }
    // Sem projeto: a organização vale se houver projeto ativo; senão, ou se não der para saber, a equipe.
    if (organization.isPending) {
      return buildCapabilities(undefined, true)
    }
    if (organizationData === undefined || !organizationData.hasActiveProjects) {
      return buildCapabilities(teamGranted, teamLoading, teamWindingDown)
    }
    return buildCapabilities(teamGranted, teamLoading, [], scopeOf(organizationData.modules, level))
  }, [
    selectedProjectId,
    project.isError,
    projectModules,
    organization.isPending,
    organizationData,
    teamGranted,
    teamLoading,
    teamWindingDown,
    level,
  ])
  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>
}
