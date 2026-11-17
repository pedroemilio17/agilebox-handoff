import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Arquivar um projeto muda a lista de projetos, o quadro, o painel do gestor e os módulos da
 * organização (projeto arquivado não conta para eles).
 */
function useRefreshAfterProjectArchive() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projectModules.organization }),
    ])
}

export function useArchiveProject() {
  const api = useApi()
  const refresh = useRefreshAfterProjectArchive()
  return useMutation({
    mutationFn: (projectId: string) => api.projects.archive({ projectId }),
    onSettled: refresh,
  })
}

export function useUnarchiveProject() {
  const api = useApi()
  const refresh = useRefreshAfterProjectArchive()
  return useMutation({
    mutationFn: (projectId: string) => api.projects.unarchive({ projectId }),
    onSettled: refresh,
  })
}
