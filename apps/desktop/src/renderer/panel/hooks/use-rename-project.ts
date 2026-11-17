import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProjectDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Renomear troca o nome na lista de projetos (seletor, barra lateral, cartões) e atualiza o quadro. */
export function useRenameProject() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { readonly projectId: string; readonly name: string }) =>
      api.projects.rename(input),
    onSuccess: (renamed) => {
      queryClient.setQueriesData<ProjectDto[]>({ queryKey: queryKeys.projects.list }, (list) =>
        list?.map((project) => (project.id === renamed.id ? renamed : project)),
      )
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.list }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]),
  })
}
