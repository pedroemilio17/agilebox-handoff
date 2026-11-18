import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { SetTaskStartInput } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Leitura do cronograma do projeto. Sem projeto selecionado, a consulta fica desligada. Abrir o
 * cronograma marca o passo "Acompanhe pelo cronograma" no servidor: a cada leitura, o guia é lido de
 * novo para o cartão avançar sozinho.
 */
export function useSchedule(projectId: string | null) {
  const api = useApi()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.schedule.project(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.schedule.get({ projectId: projectId! }),
  })
  const { dataUpdatedAt } = query
  useEffect(() => {
    if (dataUpdatedAt === 0) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.guide.all })
  }, [dataUpdatedAt, queryClient])
  return query
}

/**
 * Mudança de datas ou de dependências mexe no cronograma, na EAP (o Gantt agrupa por entrega), no
 * guia (os passos de datas e de acompanhamento) e nas tarefas.
 */
async function refreshAfterScheduleChange(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.schedule.all })
  await queryClient.invalidateQueries({ queryKey: queryKeys.wbs.all })
  await queryClient.invalidateQueries({ queryKey: queryKeys.guide.all })
  await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
}

/** Início da tarefa (nulo remove). O prazo continua no caso de uso `tasks.update`. */
export function useSetTaskStart() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SetTaskStartInput) => api.tasks.setStart(input),
    onSuccess: () => refreshAfterScheduleChange(queryClient),
  })
}

/** Liga a sucessora à predecessora. A resposta é o cronograma novo e substitui a consulta. */
export function useAddDependency() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { readonly predecessorId: string; readonly successorId: string }) =>
      api.schedule.addDependency(input),
    onSuccess: async (view) => {
      queryClient.setQueryData(queryKeys.schedule.project(view.projectId), view)
      await refreshAfterScheduleChange(queryClient)
    },
  })
}

/** Desliga a dependência. A resposta é o cronograma novo e substitui a consulta. */
export function useRemoveDependency() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { readonly predecessorId: string; readonly successorId: string }) =>
      api.schedule.removeDependency(input),
    onSuccess: async (view) => {
      queryClient.setQueryData(queryKeys.schedule.project(view.projectId), view)
      await refreshAfterScheduleChange(queryClient)
    },
  })
}
