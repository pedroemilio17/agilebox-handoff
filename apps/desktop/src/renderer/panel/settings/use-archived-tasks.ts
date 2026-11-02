import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Tarefas arquivadas que o usuário pode ver (M3.0b). O servidor já aplica a regra de leitura:
 * gestor recebe todas do time; colaborador, só as em que participa.
 */
export function useArchivedTasks() {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.tasks.archived,
    queryFn: () => api.tasks.listArchived(),
  })
}
