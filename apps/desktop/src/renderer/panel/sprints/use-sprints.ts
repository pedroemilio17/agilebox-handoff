import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type {
  CloseSprintInput,
  CreateSprintInput,
  SprintDetailDto,
  UpdateSprintInput,
} from '@agilebox/contract'
import type { TaskStatus } from '@agilebox/core'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Sprint muda o quadro, o backlog, o detalhe das tarefas, o burndown, a EAP, o dashboard e a
 * bandeja (que recebe pelo evento de mudança). Por isso toda gravação invalida o conjunto.
 */
export function refreshSprintsEverywhere(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.backlog.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.burndown.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.wbs.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.guide.all })
}

/** Atualiza otimisticamente o status de uma tarefa nos dados cacheados de detalhe da sprint. */
export function applyTaskStatusToSprintDetail(
  detail: SprintDetailDto | undefined,
  taskId: string,
  status: TaskStatus,
  movedAt: string,
): SprintDetailDto | undefined {
  if (!detail || !Array.isArray(detail.items)) return detail
  let changed = false
  const items = detail.items.map((item) => {
    if (item.id !== taskId) return item
    changed = true
    return {
      ...item,
      status,
      updatedAt: movedAt,
      agingDays: status === 'in_progress' || status === 'review' ? 0 : null,
      ...(status === 'done' ? { overdue: false } : {}),
    }
  })
  return changed ? { ...detail, items } : detail
}

/** Sprints do projeto (todas as situações; a tela separa por aba). */
export function useSprintList(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.sprints.list(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.sprints.list({ projectId: projectId! }),
  })
}

export function useSprintDetail(sprintId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.sprints.detail(sprintId ?? ''),
    enabled: sprintId !== null,
    queryFn: () => api.sprints.get({ sprintId: sprintId! }),
  })
}

export function useCreateSprint(projectId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<CreateSprintInput, 'projectId'>) =>
      api.sprints.create({ projectId, ...input }),
    onSettled: () => refreshSprintsEverywhere(queryClient),
  })
}

export function useUpdateSprint() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSprintInput) => api.sprints.update(input),
    onSettled: () => refreshSprintsEverywhere(queryClient),
  })
}

export function useStartSprint() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sprintId: string) => api.sprints.start({ sprintId }),
    onSettled: () => refreshSprintsEverywhere(queryClient),
  })
}

export function useCloseSprint() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CloseSprintInput) => api.sprints.close(input),
    onSettled: () => refreshSprintsEverywhere(queryClient),
  })
}

export function useDiscardSprint() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { readonly sprintId: string; readonly returnToBacklog: boolean }) =>
      api.sprints.discard(
        input.returnToBacklog
          ? { sprintId: input.sprintId, returnToBacklog: true }
          : { sprintId: input.sprintId },
      ),
    onSettled: () => refreshSprintsEverywhere(queryClient),
  })
}

export function useSprintItemMutations() {
  const api = useApi()
  const queryClient = useQueryClient()
  const add = useMutation({
    mutationFn: (input: { readonly sprintId: string; readonly taskId: string }) =>
      api.sprints.addTask(input),
    onSettled: () => refreshSprintsEverywhere(queryClient),
  })
  const remove = useMutation({
    mutationFn: (input: { readonly sprintId: string; readonly taskId: string }) =>
      api.sprints.removeTask(input),
    onSettled: () => refreshSprintsEverywhere(queryClient),
  })
  return { add, remove }
}

/** Mutação de fallback para mover tarefas quando o quadro da sprint é montado fora de `App`. */
export function useMoveSprintTask(onError?: (error: unknown) => void) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, status }: { readonly taskId: string; readonly status: TaskStatus }) =>
      api.tasks.move({ taskId, status }),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.sprints.all })
      const snapshot = queryClient.getQueriesData<SprintDetailDto>({
        queryKey: queryKeys.sprints.all,
      })
      const movedAt = new Date().toISOString()
      queryClient.setQueriesData<SprintDetailDto>({ queryKey: queryKeys.sprints.all }, (current) =>
        applyTaskStatusToSprintDetail(current, taskId, status, movedAt),
      )
      return { snapshot }
    },
    onError: (error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data)
      }
      onError?.(error)
    },
    onSettled: () => refreshSprintsEverywhere(queryClient),
  })
}
