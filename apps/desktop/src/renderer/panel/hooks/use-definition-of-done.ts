import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

export type DefinitionChange =
  | { readonly kind: 'add'; readonly title: string }
  | { readonly kind: 'rename'; readonly itemId: string; readonly title: string }
  | { readonly kind: 'remove'; readonly itemId: string }
  | { readonly kind: 'move'; readonly itemId: string; readonly position: number }

export function useDefinitionOfDone(projectId: string) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.projects.definitionOfDone(projectId),
    queryFn: () => api.projects.definitionOfDone.list({ projectId }),
  })
}

/** Toda alteração devolve a lista completa; a contagem do projeto e as tarefas são atualizadas. */
export function useChangeDefinitionOfDone(projectId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (change: DefinitionChange) => {
      const dod = api.projects.definitionOfDone
      switch (change.kind) {
        case 'add':
          return dod.add({ projectId, title: change.title })
        case 'rename':
          return dod.rename({ projectId, itemId: change.itemId, title: change.title })
        case 'remove':
          return dod.remove({ projectId, itemId: change.itemId })
        case 'move':
          return dod.move({ projectId, itemId: change.itemId, position: change.position })
      }
    },
    onSuccess: (items) => {
      queryClient.setQueryData(queryKeys.projects.definitionOfDone(projectId), items)
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.list })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
    },
  })
}
