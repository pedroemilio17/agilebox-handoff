import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgileBoxApi, CreateRiskInput, UpdateRiskInput } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

type RisksApi = AgileBoxApi['risks']

/** Riscos do projeto (leitura da tela Riscos). Sem projeto selecionado, a consulta fica desligada. */
export function useRisks(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.risks.project(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.risks.list({ projectId: projectId! }),
  })
}

/**
 * Risco muda a própria tela. A EAP (que mostra a entrega do risco) e o guia também podem mudar, então
 * as três consultas são invalidadas juntas.
 */
function useRisksMutation<Input>(run: (risks: RisksApi, input: Input) => Promise<unknown>) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Input) => run(api.risks, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.risks.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.wbs.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.guide.all })
    },
  })
}

export function useCreateRisk() {
  return useRisksMutation((risks, input: CreateRiskInput) => risks.create(input))
}

export function useUpdateRisk() {
  return useRisksMutation((risks, input: UpdateRiskInput) => risks.update(input))
}

export function useRemoveRisk() {
  return useRisksMutation((risks, input: { readonly riskId: string }) => risks.remove(input))
}

/** Membros do projeto, para escolher o dono do risco. */
export function useRiskOwners(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.projects.members(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.projects.listMembers({ projectId: projectId! }),
  })
}
