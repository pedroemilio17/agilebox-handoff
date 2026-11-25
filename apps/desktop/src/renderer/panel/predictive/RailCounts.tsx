import { Component, useEffect, type ReactNode } from 'react'
import type { PanelView } from '../layout/PanelShell'
import { useMilestones } from '../hooks/use-milestones'
import { useRisks } from '../hooks/use-risks'
import { useWbs } from '../hooks/use-wbs'

export type RailCountMap = Partial<Record<PanelView, string>>

function Probe({
  projectId,
  views,
  onCounts,
}: {
  readonly projectId: string | null
  readonly views: readonly PanelView[]
  readonly onCounts: (counts: RailCountMap) => void
}) {
  const wbs = useWbs(views.includes('wbs') ? projectId : null)
  const risks = useRisks(views.includes('risks') ? projectId : null)
  const milestones = useMilestones(views.includes('milestones') ? projectId : null)
  const wbsCount = wbs.data ? String(wbs.data.summary.deliverables) : undefined
  const risksCount = risks.data ? String(risks.data.risks.length) : undefined
  const milestonesCount = milestones.data ? String(milestones.data.milestones.length) : undefined
  useEffect(() => {
    onCounts({
      ...(wbsCount !== undefined ? { wbs: wbsCount } : {}),
      ...(risksCount !== undefined ? { risks: risksCount } : {}),
      ...(milestonesCount !== undefined ? { milestones: milestonesCount } : {}),
    })
  }, [wbsCount, risksCount, milestonesCount, onCounts])
  return null
}

/** Contadores são enfeite: se faltar API ou consulta, o rail segue sem número. */
class Quiet extends Component<{ readonly children: ReactNode }, { readonly failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Busca os contadores do rail (entregas, riscos, marcos) e entrega ao pai; não desenha nada. */
export function RailCounts(props: {
  readonly projectId: string | null
  readonly views: readonly PanelView[]
  readonly onCounts: (counts: RailCountMap) => void
}) {
  return (
    <Quiet>
      <Probe {...props} />
    </Quiet>
  )
}
