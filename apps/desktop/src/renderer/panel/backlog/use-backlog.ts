import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { ProjectDto, TaskDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import type { BacklogMove } from './backlog-order'
import { applyMove } from './backlog-order'

/**
 * Backlog, quadro, detalhe, dashboard e guia mudam juntos quando um item entra, sai ou muda de
 * lugar. O guia entra porque ordenar o backlog conclui o passo "Ordene pela importância".
 */
export function refreshBacklogAndBoard(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.backlog.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.guide.all })
}

export function useBacklogList(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.backlog.list(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.backlog.list({ projectId: projectId! }),
  })
}

/**
 * Projetos em que a pessoa participa (o gestor vê todos). Quem não é gestor confere a lista de
 * membros de cada projeto; enquanto não chega, nenhum projeto aparece.
 */
export function useBacklogProjects(
  projects: readonly ProjectDto[],
  isManager: boolean,
  userId: string | undefined,
) {
  const api = useApi()
  const members = useQueries({
    queries: projects.map((project) => ({
      queryKey: queryKeys.projects.members(project.id),
      queryFn: () => api.projects.listMembers({ projectId: project.id }),
      enabled: !isManager,
    })),
  })
  if (isManager) return { projects: [...projects], pending: false }
  const pending = members.some((query) => query.isPending)
  if (pending) return { projects: [] as ProjectDto[], pending: true }
  const visible = projects.filter((_project, index) =>
    (members[index]?.data ?? []).some((member) => member.id === userId),
  )
  return { projects: visible, pending: false }
}

export function useAddToBacklog(projectId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (title: string) => api.backlog.add({ projectId, title }),
    onSettled: () => refreshBacklogAndBoard(queryClient),
  })
}

interface ReorderVariables {
  readonly move: BacklogMove
  readonly from: number
  readonly to: number
}

/** Reordenação otimista: a lista muda na hora e volta à ordem anterior se o servidor recusar. */
export function useReorderBacklog(projectId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  const key = queryKeys.backlog.list(projectId)
  return useMutation({
    mutationFn: ({ move }: ReorderVariables) => api.backlog.reorder(move),
    onMutate: async ({ from, to }: ReorderVariables) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<TaskDto[]>(key)
      if (previous) queryClient.setQueryData<TaskDto[]>(key, applyMove(previous, from, to))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => refreshBacklogAndBoard(queryClient),
  })
}

export function usePullFromBacklog() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      readonly taskId: string
      readonly status: 'todo' | 'in_progress' | 'review' | 'done'
      readonly confirmedDefinitionItemIds?: readonly string[]
    }) =>
      api.backlog.pull({
        taskId: input.taskId,
        status: input.status,
        ...(input.confirmedDefinitionItemIds && input.confirmedDefinitionItemIds.length > 0
          ? { confirmedDefinitionItemIds: [...input.confirmedDefinitionItemIds] }
          : {}),
      }),
    onSettled: () => refreshBacklogAndBoard(queryClient),
  })
}

export function useSendToBacklog(taskId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.backlog.sendBack({ taskId }),
    onSettled: () => {
      refreshBacklogAndBoard(queryClient)
      void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
    },
  })
}
