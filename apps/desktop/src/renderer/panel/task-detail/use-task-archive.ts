import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TaskDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { useUndo } from '../layout/UndoProvider'

/**
 * Arquiva a tarefa (M2.12). Some das listas na hora, volta se o servidor recusar e oferece
 * desfazer no aviso de 8 s. A linha do tempo não é apagada: arquivar só marca a data.
 */
export function useTaskArchive(taskId: string, taskTitle: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  const { offer } = useUndo()

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
  }

  return useMutation({
    mutationFn: () => api.tasks.archive({ taskId }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all })
      const snapshot = queryClient.getQueriesData<TaskDto[]>({ queryKey: queryKeys.tasks.all })
      queryClient.setQueriesData<TaskDto[]>({ queryKey: queryKeys.tasks.all }, (current) =>
        Array.isArray(current) ? current.filter((task) => task.id !== taskId) : current,
      )
      return { snapshot }
    },
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data)
    },
    onSuccess: () => {
      offer({
        message: `Tarefa “${taskTitle}” arquivada`,
        undo: async () => {
          await api.tasks.unarchive({ taskId })
          refresh()
        },
      })
    },
    onSettled: refresh,
  })
}
