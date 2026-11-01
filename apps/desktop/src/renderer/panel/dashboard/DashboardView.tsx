import { useQuery } from '@tanstack/react-query'
import { TASK_STATUSES } from '@agilebox/core'
import { EmptyState, Skeleton } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { panelCopy } from '../copy'
import { CollaboratorTable } from './CollaboratorTable'
import { StackedBar } from './StackedBar'
import { StatCard } from './StatCard'
import type { CollaboratorStat } from './types'
import styles from './Dashboard.module.css'

export interface DashboardViewProps {
  readonly onOpenProjects: (user: CollaboratorStat['user']) => void
}

export function DashboardView({ onOpenProjects }: DashboardViewProps) {
  const api = useApi()
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: () => api.dashboard.get(),
  })

  if (dashboard.isPending) {
    return (
      <div className={styles.view} role="status" aria-label={panelCopy.dashboardLoading}>
        <Skeleton />
        <Skeleton />
      </div>
    )
  }
  if (dashboard.isError) return <p role="alert">{panelCopy.dashboardError}</p>

  const { distribution, collaborators } = dashboard.data
  const empty = TASK_STATUSES.every((status) => distribution[status] === 0)
  if (empty && collaborators.length === 0) return <EmptyState title={panelCopy.dashboardEmpty} />

  return (
    <div className={styles.view}>
      <StackedBar distribution={distribution} label={panelCopy.dashboardOverview} />
      <div className={styles.stats}>
        {TASK_STATUSES.map((status) => (
          <StatCard key={status} status={status} percentage={distribution[status]} />
        ))}
      </div>
      <CollaboratorTable collaborators={collaborators} onOpenProjects={onOpenProjects} />
    </div>
  )
}
