import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Projetos arquivados. O contrato de `projects.list` não traz `archivedAt`, então a lista de
 * arquivados é a diferença entre a lista com `includeArchived` e a lista padrão (só ativos).
 */
export function useArchivedProjects() {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.projects.archived,
    queryFn: async () => {
      const [everything, active] = await Promise.all([
        api.projects.list({ includeArchived: true }),
        api.projects.list(),
      ])
      const activeIds = new Set(active.map((project) => project.id))
      return everything.filter((project) => !activeIds.has(project.id))
    },
  })
}
