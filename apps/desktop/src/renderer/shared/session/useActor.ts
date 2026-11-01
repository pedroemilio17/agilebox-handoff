import {
  canManageMeetings,
  canSeeDashboard,
  canSeeTaskTotal,
  toOrganizationId,
  toUserId,
} from '@agilebox/core'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api/ApiProvider'
import { queryKeys } from '../query/keys'

export function useActor() {
  const api = useApi()
  const session = useQuery({
    queryKey: queryKeys.session.current,
    queryFn: () => api.session.getCurrent(),
  })
  const current = session.data
  const actor = current
    ? {
        userId: toUserId(current.userId),
        organizationId: toOrganizationId(current.organizationId),
        role: current.role,
      }
    : undefined

  return {
    ...session,
    actor,
    capabilities: actor
      ? {
          canSeeRates: actor.role === 'manager',
          canSeeTaskTotal: canSeeTaskTotal(actor, actor.organizationId),
          canManageMeetings: canManageMeetings(actor, actor.organizationId),
          canSeeDashboard: canSeeDashboard(actor, actor.organizationId),
        }
      : undefined,
  }
}
