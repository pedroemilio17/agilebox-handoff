import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'

/**
 * Guia de primeiros passos do projeto, da pessoa que está logada. Sem projeto selecionado, a consulta
 * fica desligada. Atualiza junto com o resto do painel: a sincronização de mudanças invalida as
 * consultas do painel e esta incluída.
 */
export function useGuide(projectId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.guide.project(projectId ?? ''),
    enabled: projectId !== null,
    queryFn: () => api.guide.get({ projectId: projectId! }),
  })
}
