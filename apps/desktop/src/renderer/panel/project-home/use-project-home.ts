import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Quadro do projeto: as mesmas tarefas da tela Quadro (mesma chave de cache), com as contagens de
 * WIP. O servidor já filtra o que cada pessoa pode ver.
 */
export function useProjectHomeBoard(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.tasks.board(projectId ?? undefined, undefined, false),
    enabled: projectId !== null,
    queryFn: () => api.tasks.listBoard({ projectId: projectId! }),
  })
}

/** Time do projeto (membros). Sem projeto, a consulta fica desligada. */
export function useProjectHomeMembers(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.projects.members(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.projects.listMembers({ projectId: projectId! }),
  })
}
