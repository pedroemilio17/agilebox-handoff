import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateProjectWithSetupInput } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Criação pelo assistente de novo projeto. Nome repetido não dá erro: a API devolve o projeto
 * existente, e quem chama o seleciona. Como em `useCreateProject`, só a lista de projetos muda.
 */
export function useCreateProjectWithSetup() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectWithSetupInput) => api.projects.createWithSetup(input),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.list }),
  })
}
