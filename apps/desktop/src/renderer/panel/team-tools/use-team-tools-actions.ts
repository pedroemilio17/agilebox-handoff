import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ApplyTeamPresetInput,
  CompleteTeamWindDownInput,
  SetTeamLevelInput,
  TeamToolsChangeInput,
  TeamToolsChangeResultDto,
} from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Mudanças nas ferramentas da equipe. Qualquer gravação atualiza a visão de `teamTools` com o
 * resultado e invalida o que depende das ferramentas (quadro, bandeja, agenda e dashboard), para o
 * menu e as telas se adaptarem na hora. A mudança de outra janela ou computador chega pelo canal de
 * mudanças (`sync-changes`), que já invalida tudo.
 */
export function useTeamToolsActions() {
  const api = useApi()
  const queryClient = useQueryClient()

  function refresh(result: TeamToolsChangeResultDto) {
    queryClient.setQueryData(queryKeys.teamTools.view, result.view)
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.teamTools.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all }),
    ])
  }

  return {
    applyChange: useMutation({
      mutationFn: (input: TeamToolsChangeInput) => api.teamTools.applyChange(input),
      onSuccess: refresh,
    }),
    completeWindDown: useMutation({
      mutationFn: (input: CompleteTeamWindDownInput) => api.teamTools.completeWindDown(input),
      onSuccess: refresh,
    }),
    setLevel: useMutation({
      mutationFn: (input: SetTeamLevelInput) => api.teamTools.setLevel(input),
      onSuccess: refresh,
    }),
    applyPreset: useMutation({
      mutationFn: (input: ApplyTeamPresetInput) => api.teamTools.applyPreset(input),
      onSuccess: refresh,
    }),
  }
}
