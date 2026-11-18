import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgileBoxApi, WbsViewDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

type WbsApi = AgileBoxApi['wbs']

/** Leitura da EAP do projeto. Sem projeto selecionado, a consulta fica desligada. */
export function useWbs(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.wbs.project(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.wbs.get({ projectId: projectId! }),
  })
}

/**
 * Cada mutação da EAP devolve a visão nova: ela substitui a consulta. Entregas mudam o guia (o passo
 * "Liste as entregas principais" se conclui sozinho) e as tarefas (a ligação com a entrega aparece no
 * quadro e no detalhe).
 */
function useWbsMutation<Input>(run: (wbs: WbsApi, input: Input) => Promise<WbsViewDto>) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Input) => run(api.wbs, input),
    onSuccess: async (view) => {
      queryClient.setQueryData(queryKeys.wbs.project(view.projectId), view)
      await queryClient.invalidateQueries({ queryKey: queryKeys.guide.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
    },
  })
}

export function useCreateDeliverable() {
  return useWbsMutation((wbs, input: Parameters<WbsApi['createDeliverable']>[0]) =>
    wbs.createDeliverable(input),
  )
}

export function useRenameDeliverable() {
  return useWbsMutation((wbs, input: Parameters<WbsApi['renameDeliverable']>[0]) =>
    wbs.renameDeliverable(input),
  )
}

export function useMoveDeliverable() {
  return useWbsMutation((wbs, input: Parameters<WbsApi['moveDeliverable']>[0]) =>
    wbs.moveDeliverable(input),
  )
}

export function useRemoveDeliverable() {
  return useWbsMutation((wbs, input: Parameters<WbsApi['removeDeliverable']>[0]) =>
    wbs.removeDeliverable(input),
  )
}
