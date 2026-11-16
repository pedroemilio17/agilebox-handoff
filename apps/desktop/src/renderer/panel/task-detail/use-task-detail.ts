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

/** Bloquear abre o impedimento; `ownerId` é o responsável por resolver (opcional). */
export function useBlockTask(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { readonly reason: string; readonly ownerId?: string }) =>
      api.tasks.block({
        taskId,
        reason: input.reason,
        ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      }),
    onSuccess: () => refreshAfterBlock(queryClient, taskId),
  })
}

/** Resolver é o desbloqueio com nota opcional; a tarefa sai do estado bloqueado. */
export function useUnblockTask(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (resolution?: string | null) =>
      api.tasks.unblock({ taskId, ...(resolution ? { resolution } : {}) }),
    onSuccess: () => refreshAfterBlock(queryClient, taskId),
  })
}

/** Bloqueio e desbloqueio mexem no impedimento: a lista, o quadro, o dashboard e a linha do tempo. */
function refreshAfterBlock(queryClient: ReturnType<typeof useQueryClient>, taskId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.impediments.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
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

/** Arquivar e desarquivar mudam o quadro, o detalhe, a linha do tempo e o painel do gestor. */
function refreshAfterArchive(queryClient: ReturnType<typeof useQueryClient>, taskId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
}

export function useArchiveTask(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.tasks.archive({ taskId }),
    onSettled: () => refreshAfterArchive(queryClient, taskId),
  })
}

export function useUnarchiveTask(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.tasks.unarchive({ taskId }),
    onSettled: () => refreshAfterArchive(queryClient, taskId),
  })
}

/**
 * Critérios e estimativa (M3.3) mudam a tarefa, o quadro, o backlog, o dashboard e a linha do tempo.
 */
function refreshAfterCriteriaOrEstimate(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: string,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.backlog.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
}

export function useAddCriterion(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => api.tasks.criteria.add({ taskId, text }),
    onSettled: () => refreshAfterCriteriaOrEstimate(queryClient, taskId),
  })
}

export function useToggleCriterion(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ criterionId, done }: { readonly criterionId: string; readonly done: boolean }) =>
      api.tasks.criteria.toggle({ taskId, criterionId, done }),
    onSettled: () => refreshAfterCriteriaOrEstimate(queryClient, taskId),
  })
}

export function useRenameCriterion(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ criterionId, text }: { readonly criterionId: string; readonly text: string }) =>
      api.tasks.criteria.rename({ taskId, criterionId, text }),
    onSettled: () => refreshAfterCriteriaOrEstimate(queryClient, taskId),
  })
}

export function useRemoveCriterion(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (criterionId: string) => api.tasks.criteria.remove({ taskId, criterionId }),
    onSettled: () => refreshAfterCriteriaOrEstimate(queryClient, taskId),
  })
}

export function useMoveCriterion(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      criterionId,
      position,
    }: {
      readonly criterionId: string
      readonly position: number
    }) => api.tasks.criteria.move({ taskId, criterionId, position }),
    onSettled: () => refreshAfterCriteriaOrEstimate(queryClient, taskId),
  })
}

/** Estimativa em horas; `null` tira a estimativa. */
export function useSetEstimate(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (estimatedHours: number | null) =>
      api.tasks.setEstimate({ taskId, estimatedHours }),
    onSettled: () => refreshAfterCriteriaOrEstimate(queryClient, taskId),
  })
}
