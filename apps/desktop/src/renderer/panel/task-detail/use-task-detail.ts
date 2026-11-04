import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GetTaskDto, TaskUpdateInput } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { applyChecklistToggle } from './checklist-optimistic'

export function useTaskDetail(taskId: string) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => api.tasks.get({ taskId }),
  })
}

export function useUpdateTask(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: TaskUpdateInput['changes']) => api.tasks.update({ taskId, changes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
    },
  })
}

export function useMoveTaskStatus(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      status,
      confirmedDefinitionItemIds,
    }: {
      readonly status: Parameters<typeof api.tasks.move>[0]['status']
      readonly confirmedDefinitionItemIds?: readonly string[]
    }) =>
      api.tasks.move({
        taskId,
        status,
        ...(confirmedDefinitionItemIds && confirmedDefinitionItemIds.length > 0
          ? { confirmedDefinitionItemIds: [...confirmedDefinitionItemIds] }
          : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
    },
  })
}

export function useBlockTask(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => api.tasks.block({ taskId, reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
    },
  })
}

export function useUnblockTask(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.tasks.unblock({ taskId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
    },
  })
}

/** Atualiza a tarefa e a linha do tempo depois de subtarefas e comentários. */
function refreshAfterChecklist(queryClient: ReturnType<typeof useQueryClient>, taskId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
}

export function useAddChecklistItem(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (title: string) => api.tasks.checklist.add({ taskId, title }),
    onSettled: () => refreshAfterChecklist(queryClient, taskId),
  })
}

/** Atualização otimista: a marcação aparece na hora e volta se o servidor recusar. */
export function useToggleChecklistItem(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  const key = queryKeys.tasks.detail(taskId)
  return useMutation({
    mutationFn: ({ itemId, done }: { readonly itemId: string; readonly done: boolean }) =>
      api.tasks.checklist.toggle({ taskId, itemId, done }),
    onMutate: async ({ itemId, done }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<GetTaskDto>(key)
      if (previous)
        queryClient.setQueryData<GetTaskDto>(key, applyChecklistToggle(previous, itemId, done))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => refreshAfterChecklist(queryClient, taskId),
  })
}

export function useRenameChecklistItem(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, title }: { readonly itemId: string; readonly title: string }) =>
      api.tasks.checklist.rename({ taskId, itemId, title }),
    onSettled: () => refreshAfterChecklist(queryClient, taskId),
  })
}

export function useRemoveChecklistItem(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => api.tasks.checklist.remove({ taskId, itemId }),
    onSettled: () => refreshAfterChecklist(queryClient, taskId),
  })
}

export function useMoveChecklistItem(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, position }: { readonly itemId: string; readonly position: number }) =>
      api.tasks.checklist.move({ taskId, itemId, position }),
    onSettled: () => refreshAfterChecklist(queryClient, taskId),
  })
}

export function useAddComment(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => api.tasks.comments.add({ taskId, body }),
    onSettled: () => refreshAfterChecklist(queryClient, taskId),
  })
}

export function useEditComment(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, body }: { readonly commentId: string; readonly body: string }) =>
      api.tasks.comments.edit({ taskId, commentId, body }),
    onSettled: () => refreshAfterChecklist(queryClient, taskId),
  })
}

export function useRemoveComment(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => api.tasks.comments.remove({ taskId, commentId }),
    onSettled: () => refreshAfterChecklist(queryClient, taskId),
  })
}
