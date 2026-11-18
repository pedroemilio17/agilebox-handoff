import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChangeProjectModulesInput } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Liga e desliga módulos do projeto (só o gestor; o servidor recusa o resto). Depois da gravação,
 * módulos, guia, quadro, backlog e sprints são recarregados, porque ligar ou desligar muda o que
 * essas telas mostram.
 */
export function useChangeProjectModules(projectId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: Omit<ChangeProjectModulesInput, 'projectId'>) =>
      api.projectModules.change({ projectId, ...changes }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projectModules.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.guide.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backlog.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all }),
      ])
    },
  })
}
