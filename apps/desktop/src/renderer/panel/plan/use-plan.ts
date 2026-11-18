import { useQueries } from '@tanstack/react-query'
import type { SprintDto, TaskDto, WbsViewDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { useWbs } from '../hooks/use-wbs'
import { useSprintList } from '../sprints/use-sprints'
import type { SprintItemsById } from './plan-screen'

export interface PlanData {
  readonly wbs: WbsViewDto | undefined
  readonly sprints: readonly SprintDto[]
  /** Itens de cada sprint. Enquanto um detalhe carrega, a sprint conta como vazia. */
  readonly itemsById: SprintItemsById
  readonly isPending: boolean
  readonly isError: boolean
  readonly refetch: () => void
}

/**
 * Dados do plano: EAP, sprints do projeto e os itens de cada sprint (um detalhe por sprint, com o
 * mesmo cache da tela de Sprints). Nada novo no servidor: é a leitura que as telas já fazem.
 */
export function usePlanData(projectId: string | null): PlanData {
  const api = useApi()
  const wbs = useWbs(projectId)
  const sprints = useSprintList(projectId)
  const sprintList = sprints.data ?? []
  const details = useQueries({
    queries: sprintList.map((sprint) => ({
      queryKey: queryKeys.sprints.detail(sprint.id),
      queryFn: () => api.sprints.get({ sprintId: sprint.id }),
    })),
  })
  const itemsById: Record<string, readonly TaskDto[] | undefined> = {}
  sprintList.forEach((sprint, index) => {
    itemsById[sprint.id] = details[index]?.data?.items
  })
  const detailFailed = details.some((detail) => detail.isError)
  return {
    wbs: wbs.data,
    sprints: sprintList,
    itemsById,
    isPending: wbs.isPending || sprints.isPending || details.some((detail) => detail.isPending),
    isError: wbs.isError || sprints.isError || detailFailed,
    refetch: () => {
      void wbs.refetch()
      void sprints.refetch()
    },
  }
}
