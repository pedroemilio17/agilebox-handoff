import type { ExperienceLevel } from '@agilebox/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Grava o nível do time (só o gestor vê o controle). Ao dar certo, invalida as capacidades do
 * time: o menu e as telas liberadas dependem do nível.
 */
export function useSetTeamLevel() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (level: ExperienceLevel) => api.teamSettings.setLevel({ level }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.teamModules.capabilities }),
  })
}
