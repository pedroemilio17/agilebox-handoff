import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api/ApiProvider'
import { queryKeys } from '../query/keys'

/** Módulos mudam pouco; a leitura da organização volta a ser pedida no máximo a cada 30 s. */
export const ORGANIZATION_MODULES_STALE_TIME_MS = 30_000

/**
 * Estado dos módulos na organização inteira (`projectModules.getOrganization`), usado sem projeto
 * selecionado. Com `enabled` falso, a consulta não roda: com um projeto selecionado, vale o do projeto.
 */
export function useOrganizationModules(enabled: boolean) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.projectModules.organization,
    enabled,
    staleTime: ORGANIZATION_MODULES_STALE_TIME_MS,
    queryFn: () => api.projectModules.getOrganization(),
  })
}
