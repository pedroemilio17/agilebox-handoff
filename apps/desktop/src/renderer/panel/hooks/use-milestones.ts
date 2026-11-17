import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgileBoxApi, CreateMilestoneInput, UpdateMilestoneInput } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

type MilestonesApi = AgileBoxApi['milestones']

/** Marcos do projeto (leitura da tela Marcos). Sem projeto selecionado, a consulta fica desligada. */
export function useMilestones(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.milestones.project(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.milestones.list({ projectId: projectId! }),
  })
}

/**
 * Marco muda a própria tela, a EAP (que mostra os marcos das entregas) e o guia (o passo "Marque os
 * marcos" se conclui sozinho).
 */
function useMilestonesMutation<Input>(
  run: (milestones: MilestonesApi, input: Input) => Promise<unknown>,
) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Input) => run(api.milestones, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.wbs.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.guide.all })
    },
  })
}

export function useCreateMilestone() {
  return useMilestonesMutation((milestones, input: CreateMilestoneInput) =>
    milestones.create(input),
  )
}

export function useUpdateMilestone() {
  return useMilestonesMutation((milestones, input: UpdateMilestoneInput) =>
    milestones.update(input),
  )
}

export function useRemoveMilestone() {
  return useMilestonesMutation((milestones, input: { readonly milestoneId: string }) =>
    milestones.remove(input),
  )
}
