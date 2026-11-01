import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Participant } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

function useRefreshTask(taskId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
  }
}

export function useContributors() {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.contributors.all,
    queryFn: () => api.contributors.list(),
  })
}

export function useCreateContributor() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.contributors.create({ name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contributors.all }),
  })
}

export function useAddParticipation(taskId: string) {
  const api = useApi()
  const refresh = useRefreshTask(taskId)
  return useMutation({
    mutationFn: (input: { participant: Participant; role: 'responsible' | 'support' }) =>
      api.participations.add({ taskId, ...input }),
    onSuccess: refresh,
  })
}

export function useRemoveParticipation(taskId: string) {
  const api = useApi()
  const refresh = useRefreshTask(taskId)
  return useMutation({
    mutationFn: (participationId: string) => api.participations.remove({ taskId, participationId }),
    onSuccess: refresh,
  })
}

export function useSetHours(taskId: string) {
  const api = useApi()
  const refresh = useRefreshTask(taskId)
  return useMutation({
    mutationFn: (input: { participationId: string; hours: string }) =>
      api.participations.setHours({ taskId, ...input }),
    onSuccess: refresh,
  })
}

/** Editar o valor/hora na tarefa também atualiza o padrão do envolvido (PLANO 2.4). */
export function useSetRate(taskId: string) {
  const api = useApi()
  const refresh = useRefreshTask(taskId)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      participationId: string
      participant: Participant
      rateCents: number
    }) => {
      await api.participations.setRate({
        taskId,
        participationId: input.participationId,
        rateCents: input.rateCents,
      })
      if (input.participant.kind === 'user') {
        await api.users.setDefaultRate({
          userId: input.participant.userId,
          rateCents: input.rateCents,
        })
      } else {
        await api.contributors.setDefaultRate({
          contributorId: input.participant.contributorId,
          rateCents: input.rateCents,
        })
      }
    },
    onSettled: () => {
      refresh()
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.users })
      void queryClient.invalidateQueries({ queryKey: queryKeys.contributors.all })
    },
  })
}

export function useTimeline(taskId: string) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.timeline.list(taskId),
    queryFn: () => api.timeline.list({ taskId }),
  })
}
