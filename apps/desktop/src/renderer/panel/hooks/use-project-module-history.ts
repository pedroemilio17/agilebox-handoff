import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Histórico de mudanças de módulos do projeto, do mais recente para o mais antigo. Sem projeto
 * selecionado, a consulta fica desligada. Ligar ou desligar módulos invalida esta consulta junto
 * com as outras de módulos.
 */
export function useProjectModuleHistory(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.projectModules.history(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.projectModules.history({ projectId: projectId! }),
  })
}
