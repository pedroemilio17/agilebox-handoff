import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Arquivar um projeto muda a lista de projetos, o quadro e o painel do gestor. */
function useRefreshAfterProjectArchive() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
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
