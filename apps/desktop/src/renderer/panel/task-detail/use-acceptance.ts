import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CriteriaViewDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { backlogKeys } from '../backlog/query-keys'
import { taskDetailKeys } from './keys'

export type AcceptanceAction =
  | { readonly kind: 'add'; readonly text: string }
  | { readonly kind: 'edit'; readonly criterionId: string; readonly text: string }
  | { readonly kind: 'setDone'; readonly criterionId: string; readonly done: boolean }
  | { readonly kind: 'remove'; readonly criterionId: string }
  | { readonly kind: 'reorder'; readonly criterionId: string; readonly toIndex: number }

export function useAcceptanceList(taskId: string) {
  const api = useApi()
  return useQuery({
    queryKey: taskDetailKeys.acceptance(taskId),
    queryFn: () => api.acceptance.list({ taskId }),
  })
}

/**
 * Uma mutação para as cinco ações de critério. A resposta do servidor (lista e resumo) substitui
 * a lista em cache: não há releitura, então o que a tela mostra é o que o servidor gravou.
 */
export function useAcceptanceSave(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: AcceptanceAction): Promise<CriteriaViewDto> => {
      switch (action.kind) {
        case 'add':
          return api.acceptance.add({ taskId, text: action.text })
        case 'edit':
          return api.acceptance.edit({ taskId, criterionId: action.criterionId, text: action.text })
        case 'setDone':
          return api.acceptance.setDone({
            taskId,
            criterionId: action.criterionId,
            done: action.done,
          })
        case 'remove':
          return api.acceptance.remove({ taskId, criterionId: action.criterionId })
        case 'reorder':
          return api.acceptance.reorder({
            taskId,
            criterionId: action.criterionId,
            toIndex: action.toIndex,
          })
      }
    },
    onSuccess: (view) => {
      queryClient.setQueryData(taskDetailKeys.acceptance(taskId), view)
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
      // O backlog mostra o n/m de critérios de cada linha.
      void queryClient.invalidateQueries({ queryKey: backlogKeys.all })
    },
  })
}
