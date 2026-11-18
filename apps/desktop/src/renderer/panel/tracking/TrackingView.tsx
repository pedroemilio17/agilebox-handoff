import { Button, EmptyState } from '@agilebox/ui'
import type {
  TrackingMilestoneDto,
  TrackingMilestoneStatus,
  TrackingNextMilestoneDto,
} from '@agilebox/contract'
import { ModuleEmptyState } from '../guide/ModuleEmptyState'
import { ModuleHelpButton } from '../guide/ModuleHelpButton'
import type { PanelView } from '../layout/PanelShell'
import { useTracking } from '../hooks/use-tracking'
import { shortDateLabel } from '../milestones/milestone-rules'
import {
  costCaption,
  costValue,
  headerSubtitle,
  hoursCaption,
  hoursValue,
  MILESTONE_GLYPHS,
  MILESTONE_STATUS_LABELS,
  MILESTONE_TONES,
  nextMilestoneWhen,
  progressCaption,
  trackingCopy,
} from './tracking-screen'
import styles from './TrackingView.module.css'

export interface TrackingViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  readonly projectName: string | null
  /** Leva a outra tela (marcos, pelo link do estado vazio e pelo painel de ajuda). */
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Acompanhamento do projeto tradicional: concluído, horas, custo, próximo marco e a lista de marcos
 * com o status de cada um. Só mostra o que o servidor calcula; sem linha de base nem riscos (fase 6).
 */
export function TrackingView({ projectId, projectName, onNavigate }: TrackingViewProps) {
  const query = useTracking(projectId)

  if (projectId === null) {
    return (
      <section aria-label={trackingCopy.title} className={styles.view}>
        <EmptyState title={trackingCopy.noProject} />
      </section>
    )
  }

  if (query.isPending) {
    return (
      <section aria-label={trackingCopy.title} className={styles.view}>
        <p role="status" className={styles.muted}>
          {trackingCopy.loading}
        </p>
      </section>
    )
  }

  if (query.isError || !query.data) {
    return (
      <section aria-label={trackingCopy.title} className={styles.view}>
        <div role="alert" className={styles.errorBox}>
          <p className={styles.error}>{trackingCopy.loadError}</p>
          <Button type="button" onClick={() => void query.refetch()}>
            {trackingCopy.retry}
          </Button>
        </div>
      </section>
    )
  }

  const { summary, week, nextMilestone, milestones } = query.data
  const subtitle = headerSubtitle(projectName, week)

  return (
    <section aria-label={trackingCopy.title} className={styles.view}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{trackingCopy.title}</h2>
          {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
          <ModuleHelpButton
            moduleId="schedule"
            projectId={projectId}
            {...(onNavigate ? { onNavigate } : {})}
          />
        </div>
      </header>

      <div className={styles.cards}>
        <section aria-label={trackingCopy.progress} className={styles.card}>
          <p className={styles.label}>{trackingCopy.progress}</p>
          <p className={styles.value}>{summary.progress}%</p>
          <div
            role="progressbar"
            aria-label={trackingCopy.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.progress}
            aria-valuetext={`${summary.progress}%`}
            className={styles.bar}
          >
            <span className={styles.barFill} style={{ width: `${summary.progress}%` }} />
          </div>
          <p className={styles.caption}>
            {progressCaption(summary.tasks.done, summary.tasks.total)}
          </p>
        </section>

        <section aria-label={trackingCopy.hours} className={styles.card}>
          <p className={styles.label}>{trackingCopy.hours}</p>
          <p className={styles.value}>{hoursValue(summary.loggedHours)}</p>
          <p className={styles.caption}>{hoursCaption(summary.plannedHours)}</p>
        </section>

        <section aria-label={trackingCopy.cost} className={styles.card}>
          <p className={styles.label}>{trackingCopy.cost}</p>
          <p className={styles.value}>{costValue(summary.realizedCost)}</p>
          <p className={styles.caption}>
            {summary.plannedCost === null
              ? trackingCopy.costOnlyManager
              : costCaption(summary.plannedCost)}
          </p>
        </section>

        <NextMilestoneCard next={nextMilestone} />
      </div>

      <section aria-labelledby="tracking-milestones" className={styles.panel}>
        <h3 id="tracking-milestones" className={styles.panelTitle}>
          {trackingCopy.milestones}
        </h3>
        {milestones.length === 0 ? (
          <ModuleEmptyState
            moduleId="milestones"
            projectId={projectId}
            fallbackTitle={trackingCopy.noMilestones}
          >
            {onNavigate ? (
              <button
                type="button"
                className={styles.link}
                onClick={() => onNavigate('milestones')}
              >
                {trackingCopy.openMilestones}
              </button>
            ) : null}
          </ModuleEmptyState>
        ) : (
          <ol className={styles.list} aria-label={trackingCopy.milestonesLabel}>
            {milestones.map((milestone) => (
              <MilestoneItem key={milestone.id} milestone={milestone} />
            ))}
          </ol>
        )}
      </section>
    </section>
  )
}

function NextMilestoneCard({ next }: { readonly next: TrackingNextMilestoneDto | null }) {
  const atRisk = next?.status === 'at_risk'
  return (
    <section
      aria-label={trackingCopy.nextMilestone}
      className={atRisk ? `${styles.card} ${styles.cardRisk}` : styles.card}
    >
      <p className={styles.label}>{trackingCopy.nextMilestone}</p>
      {next === null ? (
        <p className={styles.nextTitle}>{trackingCopy.noNextMilestone}</p>
      ) : (
        <>
          <p className={styles.nextTitle}>{next.title}</p>
          <p className={styles.caption}>{nextMilestoneWhen(next.dueOn, next.daysLeft)}</p>
          <StatusMark status={next.status} />
        </>
      )}
    </section>
  )
}

function MilestoneItem({ milestone }: { readonly milestone: TrackingMilestoneDto }) {
  return (
    <li className={styles.item} data-status={milestone.status}>
      <span
        aria-hidden="true"
        className={styles.diamond}
        data-tone={MILESTONE_TONES[milestone.status]}
      />
      <div className={styles.itemBody}>
        <span className={styles.itemTitle}>{milestone.title}</span>
        {milestone.criterion ? (
          <span className={styles.itemMeta}>
            {trackingCopy.criterion}: {milestone.criterion}
          </span>
        ) : null}
        {milestone.deliverableTitle ? (
          <span className={styles.itemMeta}>
            {trackingCopy.deliverable}: {milestone.deliverableTitle}
          </span>
        ) : null}
      </div>
      <div className={styles.itemSide}>
        <span className={styles.date}>{shortDateLabel(milestone.dueOn)}</span>
        <StatusMark status={milestone.status} />
      </div>
    </li>
  )
}

/** Estado do marco com ícone e texto; a cor só reforça. */
function StatusMark({ status }: { readonly status: TrackingMilestoneStatus }) {
  return (
    <span className={styles.status} data-tone={MILESTONE_TONES[status]}>
      <span aria-hidden="true">{MILESTONE_GLYPHS[status]}</span>
      {MILESTONE_STATUS_LABELS[status]}
    </span>
  )
}
