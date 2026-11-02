import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Desarquiva uma tarefa pela tela de Ajustes (M3.0b), usando o mesmo `tasks.unarchive` do desfazer.
 * A tarefa volta ao quadro: invalida `tasks.all`, que cobre o quadro, as listas e a lista de
 * arquivadas (chave sob o mesmo prefixo), e a linha do tempo da tarefa.
 */
export function useUnarchiveTask() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => api.tasks.unarchive({ taskId }),
    onSuccess: async (_task, taskId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) }),
      ])
    },
  })
}
