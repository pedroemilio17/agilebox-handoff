import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { CloseSprintInput, CreateSprintInput, UpdateSprintInput } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Sprint muda o quadro, o backlog, o detalhe das tarefas, o dashboard e a bandeja (que recebe pelo
 * evento de mudança). Por isso toda gravação invalida o conjunto, não só a sprint.
 */
export function refreshSprintsEverywhere(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.backlog.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
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
