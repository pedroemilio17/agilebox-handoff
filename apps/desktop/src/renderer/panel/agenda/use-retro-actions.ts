import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MeetingOccurrenceDto, RetroActionDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Lista de combinados de uma ocorrência: série + dia (cada repetição tem a própria lista). */
export const retroActionsKey = (meetingId: string, occurrenceDate: string) =>
  [...queryKeys.meetings.all, 'retro-actions', meetingId, occurrenceDate] as const

/** Chaves das listas de agenda cujos contadores "2/3" o marcar como feito atualiza na hora. */
const isCountQuery = (key: readonly unknown[]) => key[2] === 'month' || key[2] === 'upcoming'

function patchCounts(
  data: MeetingOccurrenceDto[] | undefined,
  meetingId: string,
  occurrenceDate: string,
  delta: number,
): MeetingOccurrenceDto[] | undefined {
  if (!Array.isArray(data)) return data
  return data.map((meeting) =>
    meeting.seriesId === meetingId && meeting.occurrenceDate === occurrenceDate
      ? {
          ...meeting,
          retroActionsDone: Math.min(
            meeting.retroActionsCount,
            Math.max(0, meeting.retroActionsDone + delta),
          ),
        }
      : meeting,
  )
}

export function useRetroActions(meetingId: string, occurrenceDate: string) {
  const api = useApi()
  return useQuery({
    queryKey: retroActionsKey(meetingId, occurrenceDate),
    queryFn: () => api.meetings.retroActions.list({ meetingId, occurrenceDate }),
  })
}

/** Gestor cria: a agenda inteira é recarregada (contagens e lista). */
export function useAddRetroAction(meetingId: string, occurrenceDate: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      readonly title: string
      readonly responsibleId: string | null
      readonly dueDate: string | null
    }) => api.meetings.retroActions.add({ meetingId, occurrenceDate, ...input }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all }),
  })
}

export function useUpdateRetroAction() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      actionId,
      changes,
    }: {
      readonly actionId: string
      readonly changes: {
        readonly title: string
        readonly responsibleId: string | null
        readonly dueDate: string | null
      }
    }) => api.meetings.retroActions.update({ actionId, changes }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all }),
  })
}

export function useRemoveRetroAction() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (actionId: string) => api.meetings.retroActions.remove({ actionId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all }),
  })
}

/**
 * Marcar como feito é otimista: a lista e os contadores "2/3" mudam na hora e voltam se o
 * servidor recusar (o componente mostra o aviso).
 */
export function useToggleRetroAction(meetingId: string, occurrenceDate: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  const listKey = retroActionsKey(meetingId, occurrenceDate)
  return useMutation({
    mutationFn: ({ actionId, done }: { readonly actionId: string; readonly done: boolean }) =>
      api.meetings.retroActions.toggle({ actionId, done }),
    onMutate: async ({ actionId, done }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.meetings.all })
      const previous = queryClient.getQueryData<RetroActionDto[]>(listKey)
      const counts = queryClient
        .getQueriesData<MeetingOccurrenceDto[]>({ queryKey: queryKeys.meetings.all })
        .filter(([key]) => isCountQuery(key))
      const current = previous?.find((action) => action.id === actionId)
      if (previous)
        queryClient.setQueryData<RetroActionDto[]>(
          listKey,
          previous.map((action) =>
            action.id === actionId
              ? {
                  ...action,
                  done,
                  doneAt: done ? (action.doneAt ?? new Date().toISOString()) : null,
                }
              : action,
          ),
        )
      const delta = current && current.done !== done ? (done ? 1 : -1) : 0
      if (delta !== 0)
        for (const [key] of counts)
          queryClient.setQueryData<MeetingOccurrenceDto[]>(key, (data) =>
            patchCounts(data, meetingId, occurrenceDate, delta),
          )
      return { previous, counts }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous)
      for (const [key, data] of context?.counts ?? []) queryClient.setQueryData(key, data)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all }),
  })
}
