import { Button, EmptyState } from '@agilebox/ui'
import type {
  BaselineTaskDto,
  BaselineViewDto,
  RiskListItemDto,
  RisksListDto,
  TrackingMilestoneDto,
  TrackingMilestoneStatus,
  TrackingNextMilestoneDto,
} from '@agilebox/contract'
import { getManifest, riskScore, type RiskLevel } from '@agilebox/core'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { ModuleEmptyState } from '../guide/ModuleEmptyState'
import { ModuleHelpButton } from '../guide/ModuleHelpButton'
import type { PanelView } from '../layout/PanelShell'
import { useBaseline } from '../hooks/use-baseline'
import { useRisks } from '../hooks/use-risks'
import { useTracking } from '../hooks/use-tracking'
import { shortDateLabel } from '../milestones/milestone-rules'
import { levelLabel } from '../risks/risk-rules'
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
  outsideBaselineText,
  progressCaption,
  riskCode,
  riskHeat,
  takenDayMonth,
  trackingCopy,
} from './tracking-screen'
import styles from './TrackingView.module.css'

export interface TrackingViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  /** Nome do projeto: o subtítulo do cabeçalho o usa. */
  readonly projectName: string | null
  /** Leva às telas de edição (marcos, riscos, linha de base) pelos botões desta tela. */
  readonly onNavigate?: (view: PanelView) => void
}

/** Nível do módulo no manifesto, como o selo "N3" do design. */
function moduleTag(moduleId: 'baseline' | 'risks'): string {
  const level = getManifest(moduleId).level
  return level === null ? '' : `N${level}`
}

/**
 * Acompanhamento do projeto tradicional (tela 15 do design): concluído, horas, custo e próximo
 * marco; a lista de marcos; a linha de base e os riscos. Marcos, linha de base e riscos aparecem
 * aqui como leitura; a edição continua nas telas próprias, que os botões desta tela abrem.
 */
export function TrackingView({ projectId, projectName, onNavigate }: TrackingViewProps) {
  const capabilities = useCapabilities()
  const query = useTracking(projectId)
  const risksOn = capabilities.showScreen('risks')
  const baselineOn = capabilities.showScreen('baseline')
  const risks = useRisks(risksOn ? projectId : null)
  const baseline = useBaseline(baselineOn ? projectId : null)

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

  const { summary, week, nextMilestone, milestones, costEnabled } = query.data
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

        {costEnabled ? (
          <section aria-label={trackingCopy.cost} className={styles.card}>
            <p className={styles.label}>{trackingCopy.cost}</p>
            <p className={styles.value}>{costValue(summary.realizedCost)}</p>
            <p className={styles.caption}>
              {summary.plannedCost === null
                ? trackingCopy.costOnlyManager
                : costCaption(summary.plannedCost)}
            </p>
          </section>
        ) : null}

        <NextMilestoneCard next={nextMilestone} />
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
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

          {baselineOn ? (
            <BaselinePanel
              query={baseline.data}
              loading={baseline.isPending}
              onNavigate={onNavigate}
            />
          ) : null}
        </div>

        {risksOn ? (
          <RisksPanel query={risks.data} loading={risks.isPending} onNavigate={onNavigate} />
        ) : null}
      </div>
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
          <span className={styles.nextMeta}>
            <span className={styles.caption}>{nextMilestoneWhen(next.dueOn, next.daysLeft)}</span>
            <StatusMark status={next.status} />
          </span>
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

/** Linha de base como leitura: quando foi tirada, quem tirou e as tarefas fora dela. */
function BaselinePanel({
  query,
  loading,
  onNavigate,
}: {
  readonly query: BaselineViewDto | undefined
  readonly loading: boolean
  readonly onNavigate?: ((view: PanelView) => void) | undefined
}) {
  const tag = moduleTag('baseline')
  const photo = query?.baseline ?? null
  const late: readonly BaselineTaskDto[] = (query?.tasks ?? []).filter(
    (task) => task.status === 'late',
  )
  return (
    <section aria-labelledby="tracking-baseline" className={styles.panel}>
      <div className={styles.panelHead}>
        <h3 id="tracking-baseline" className={styles.panelTitle}>
          {trackingCopy.baseline}
        </h3>
        {tag ? <span className={styles.tag}>{tag}</span> : null}
      </div>
      {loading ? (
        <p className={styles.muted} role="status">
          {trackingCopy.loading}
        </p>
      ) : photo === null ? (
        <p className={styles.text}>{trackingCopy.noBaseline}</p>
      ) : (
        <>
          <p className={styles.text}>
            {trackingCopy.takenBy}{' '}
            <span className={styles.mono}>{takenDayMonth(photo.takenAt)}</span> por{' '}
            {photo.takenByName ?? trackingCopy.takenFallback}.
          </p>
          <p className={styles.textMuted}>{outsideBaselineText(late)}</p>
        </>
      )}
      {query?.canTake && onNavigate ? (
        <div className={styles.panelFoot}>
          <Button type="button" onClick={() => onNavigate('baseline')}>
            {trackingCopy.takeBaseline}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

/** Riscos como leitura: matriz 3 × 3 com os códigos e a lista com resposta e dono. */
function RisksPanel({
  query,
  loading,
  onNavigate,
}: {
  readonly query: RisksListDto | undefined
  readonly loading: boolean
  readonly onNavigate?: ((view: PanelView) => void) | undefined
}) {
  const tag = moduleTag('risks')
  const risks: readonly RiskListItemDto[] = query?.risks ?? []
  const cellsOf = (probability: RiskLevel, impact: RiskLevel) =>
    risks
      .map((risk, index) => ({ risk, code: riskCode(index) }))
      .filter(({ risk }) => risk.probability === probability && risk.impact === impact)
  const levels: readonly RiskLevel[] = [3, 2, 1]
  return (
    <section aria-labelledby="tracking-risks" className={styles.panel}>
      <div className={styles.panelHead}>
        <h3 id="tracking-risks" className={styles.panelTitle}>
          {trackingCopy.risks}
        </h3>
        {tag ? <span className={styles.tag}>{tag}</span> : null}
        <span className={styles.spacer} />
        {query?.canEdit && onNavigate ? (
          <Button type="button" onClick={() => onNavigate('risks')}>
            {trackingCopy.newRisk}
          </Button>
        ) : null}
      </div>
      {loading ? (
        <p className={styles.muted} role="status">
          {trackingCopy.loading}
        </p>
      ) : risks.length === 0 ? (
        <p className={styles.text}>{trackingCopy.noRisks}</p>
      ) : (
        <>
          <div role="table" aria-label={trackingCopy.riskMatrixLabel} className={styles.matrix}>
            <div role="row" className={styles.matrixRow}>
              <span role="columnheader" aria-hidden="true" />
              {trackingCopy.impactColumns.map((label) => (
                <span key={label} role="columnheader" className={styles.matrixHead}>
                  {label}
                </span>
              ))}
            </div>
            {levels.map((probability) => (
              <div key={probability} role="row" className={styles.matrixRow}>
                <span role="rowheader" className={styles.matrixSide}>
                  {trackingCopy.probabilityRows[3 - probability]}
                </span>
                {([1, 2, 3] as const).map((impact) => {
                  const cells = cellsOf(probability, impact)
                  const heat = riskHeat(riskScore(probability, impact))
                  return (
                    <div
                      key={impact}
                      role="cell"
                      className={styles.matrixCell}
                      data-heat={heat}
                      aria-label={`${levelLabel(probability)} probabilidade, ${levelLabel(impact)} impacto: ${cells.length}`}
                    >
                      {cells.map(({ code }) => (
                        <span key={code} className={styles.chip}>
                          {code}
                        </span>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <ol className={styles.riskList} aria-label={trackingCopy.riskListLabel}>
            {risks.map((risk, index) => (
              <li key={risk.id} className={styles.riskItem}>
                <span className={styles.riskCode}>{riskCode(index)}</span>
                <div className={styles.riskBody}>
                  <span className={styles.riskTitle}>{risk.title}</span>
                  <span className={styles.itemMeta}>
                    {trackingCopy.riskResponse}: {risk.response ?? trackingCopy.noResponse}
                  </span>
                </div>
                <span className={styles.avatar} title={risk.ownerName ?? trackingCopy.noOwner}>
                  <span aria-hidden="true">{initialsOf(risk.ownerName)}</span>
                  <span className={styles.srOnly}>{risk.ownerName ?? trackingCopy.noOwner}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

function initialsOf(name: string | null): string {
  if (name === null) return '—'
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '—'
}
