import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Módulos do projeto (ligado, encerrando ou desligado) com o manifesto de cada um. Sem projeto
 * selecionado, a consulta fica desligada. A sincronização de mudanças invalida a consulta junto com
 * o resto do painel.
 */
export function useProjectModules(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.projectModules.project(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.projectModules.get({ projectId: projectId! }),
  })
}
