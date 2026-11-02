import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ModuleId } from '@agilebox/core'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/** Prévia do servidor para os módulos que a mudança desliga. Só lê; não grava nada. */
export function useToolImpact(disable: readonly ModuleId[], enabled: boolean) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.teamModules.impact(disable),
    queryFn: () => api.teamModules.previewImpact({ disable: [...disable] }),
    enabled: enabled && disable.length > 0,
  })
}

/**
 * Estado da prévia de impacto para a tela. `idle` quando a mudança não desliga nada (não há o que
 * calcular). Só `ready` deixa Aplicar liberado: sem a prévia, a tela não sabe o que sai com os itens.
 */
export type ImpactState = 'idle' | 'loading' | 'error' | 'ready'

export function impactStateOf(
  needed: boolean,
  query: { readonly isPending: boolean; readonly isError: boolean },
): ImpactState {
  if (!needed) return 'idle'
  if (query.isError) return 'error'
  if (query.isPending) return 'loading'
  return 'ready'
}

export interface ToolChangeInput {
  readonly enable: readonly ModuleId[]
  readonly disable: readonly ModuleId[]
}

/**
 * Grava a mudança do rascunho. Ao dar certo, espera a releitura do estado do time e das prévias:
 * o menu e o rascunho da tela dependem do estado gravado, e o rascunho só é descartado depois disso.
 */
export function useApplyToolChange() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ToolChangeInput) =>
      api.teamModules.change({ enable: [...input.enable], disable: [...input.disable] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.teamModules.capabilities })
      await queryClient.invalidateQueries({ queryKey: queryKeys.teamModules.impactAll })
    },
  })
}
