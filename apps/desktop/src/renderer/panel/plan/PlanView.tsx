import { useMemo } from 'react'
import { Button, EmptyState } from '@agilebox/ui'
import { todayDateOnly } from '../../shared/lib/today'
import { buildPlanModel, planCopy, type PlanModel } from './plan-screen'
import { usePlanData } from './use-plan'
import styles from './PlanView.module.css'

export interface PlanViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  /** Nome do projeto, que aparece ao lado do título (como no design). */
  readonly projectName?: string | null
  /** Abre a sprint dentro da entrega (tela 18). Sem entrega, a sprint abre sem contexto de entrega. */
  readonly onOpenSprint: (sprintId: string, deliverableId: string | null) => void
}

/**
 * Plano do projeto híbrido (tela 17): entregas e marcos por cima, sprints por baixo, e a entrega
 * atual com as sprints que a atravessam. Tudo calculado a partir da EAP e das sprints.
 */
export function PlanView({ projectId, projectName, onOpenSprint }: PlanViewProps) {
  const data = usePlanData(projectId)
  const model = useMemo(
    () =>
      data.wbs
        ? buildPlanModel({
            wbs: data.wbs,
            sprints: data.sprints,
            itemsById: data.itemsById,
            today: todayDateOnly(),
          })
        : null,
    [data.wbs, data.sprints, data.itemsById],
  )

  if (projectId === null) {
    return (
      <section aria-label={planCopy.title} className={styles.view}>
        <EmptyState title={planCopy.noProject} />
      </section>
    )
  }

  if (data.isPending) {
    return (
      <section aria-label={planCopy.title} className={styles.view}>
        <p role="status" className={styles.muted}>
          {planCopy.loading}
        </p>
      </section>
    )
  }

  if (data.isError || !data.wbs || !model) {
    return (
      <section aria-label={planCopy.title} className={styles.view}>
        <div role="alert" className={styles.errorBox}>
          <p className={styles.error}>{planCopy.loadError}</p>
          <Button type="button" onClick={data.refetch}>
            {planCopy.retry}
          </Button>
        </div>
      </section>
    )
  }

  if (data.wbs.deliverables.length === 0) {
    return (
      <section aria-label={planCopy.title} className={styles.view}>
        <EmptyState title={planCopy.noDeliverables} description={planCopy.noDeliverablesHint} />
      </section>
    )
  }

  return (
    <section aria-label={planCopy.title} className={styles.view}>
      <header className={styles.header}>
        <h2 className={styles.title}>{planCopy.title}</h2>
        {projectName ? <span className={styles.projectName}>{projectName}</span> : null}
        <span className={styles.spacer} />
        {model.activeSprint ? (
          <Button
            type="button"
            onClick={() => onOpenSprint(model.activeSprint!.id, model.activeSprint!.deliverableId)}
          >
            {planCopy.openActive(model.activeSprint.number)}
          </Button>
        ) : null}
      </header>

      <Timeline model={model} />

      <div className={styles.lower}>
        <CurrentCard model={model} onOpenSprint={onOpenSprint} />
        <NextCard model={model} />
        <aside aria-labelledby="plan-how" className={styles.how}>
          <h3 id="plan-how" className={styles.label}>
            {planCopy.howTitle}
          </h3>
          {planCopy.howSteps.map((step, index) => (
            <div key={step.lead} className={styles.howStep}>
              <span className={styles.howNumber}>{index + 1}</span>
              <span className={styles.howText}>
                <strong className={styles.howLead}>{step.lead}</strong> {step.text}
              </span>
            </div>
          ))}
        </aside>
      </div>
    </section>
  )
}

/** Linha do tempo: entregas (com as sprints que atravessam), marcos e as sprints do projeto. */
function Timeline({ model }: { readonly model: PlanModel }) {
  if (model.timeline === null) {
    return (
      <section aria-label={planCopy.timelineLabel} className={styles.timeline}>
        <p className={styles.muted}>{planCopy.noDates}</p>
      </section>
    )
  }
  const { timeline } = model
  return (
    <section aria-label={planCopy.timelineLabel} className={styles.timeline}>
      <div className={styles.timelineBody}>
        {timeline.today !== null ? (
          <span
            aria-hidden="true"
            className={styles.todayLine}
            style={{ left: `calc(110px + (100% - 110px) * ${timeline.today / 100})` }}
          />
        ) : null}
        <div className={styles.grid}>
          <span />
          <div className={styles.axis}>
            {timeline.months.map((month, index) => (
              <span
                key={`${month.label}-${index}`}
                className={styles.month}
                style={{ left: `${month.left}%` }}
              >
                {month.label}
              </span>
            ))}
          </div>

          <span className={styles.lane}>{planCopy.laneEntregas}</span>
          <div className={styles.track} style={{ height: `${model.laneCount * 70}px` }}>
            {model.bars.map((bar) => (
              <div
                key={bar.id}
                className={`${styles.bar} ${bar.current ? styles.barCurrent : ''}`}
                style={{
                  left: `${bar.left}%`,
                  width: `calc(${bar.width}% - 6px)`,
                  top: `${bar.lane * 70}px`,
                }}
              >
                <span className={styles.barName}>{bar.label}</span>
                <span className={styles.barMeta}>{bar.meta}</span>
              </div>
            ))}
          </div>

          <span className={styles.lane}>{planCopy.laneMarcos}</span>
          <div className={styles.trackSmall}>
            {model.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={styles.milestone}
                style={{
                  left: `${milestone.left}%`,
                  transform: milestone.left > 80 ? 'translateX(-100%)' : 'translateX(-6px)',
                }}
              >
                <span aria-hidden="true" className={styles.diamond} />
                <span className={styles.milestoneText}>
                  <span className={styles.milestoneTitle}>{milestone.title}</span>
                  <span className={styles.milestoneDate}>{milestone.date}</span>
                </span>
              </div>
            ))}
          </div>

          <span className={styles.lane}>{planCopy.laneSprints}</span>
          <div className={styles.trackSmall}>
            {model.sprints.map((sprint) => (
              <span
                key={sprint.id}
                className={`${styles.sprintChip} ${sprintChipClass(sprint.status)}`}
                style={{ left: `${sprint.left}%`, width: `calc(${sprint.width}% - 4px)` }}
              >
                {sprint.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function sprintChipClass(status: 'draft' | 'active' | 'closed'): string {
  if (status === 'closed') return styles.chipDone ?? ''
  if (status === 'active') return styles.chipCurrent ?? ''
  return styles.chipFuture ?? ''
}

function CurrentCard({
  model,
  onOpenSprint,
}: {
  readonly model: PlanModel
  readonly onOpenSprint: PlanViewProps['onOpenSprint']
}) {
  const current = model.current
  return (
    <section aria-labelledby="plan-current" className={`${styles.card} ${styles.currentCard}`}>
      <div className={styles.cardHead}>
        <span className={styles.label}>{planCopy.currentLabel}</span>
        <h3 id="plan-current" className={styles.cardTitle}>
          {current ? current.label : planCopy.noCurrent}
        </h3>
      </div>
      {current ? (
        <>
          <div className={styles.progressLine}>
            <span aria-hidden="true" className={styles.track2}>
              <span className={styles.fill} style={{ width: `${current.progress}%` }} />
            </span>
            <span className={styles.mono}>{current.progress}%</span>
          </div>
          <dl className={styles.facts}>
            {current.milestone ? (
              <div className={styles.fact}>
                <dt className={styles.factLabel}>{planCopy.milestoneLabel}</dt>
                <dd className={styles.factValue}>{current.milestone}</dd>
              </div>
            ) : null}
            {current.sprints.map((line) => (
              <div key={line.sprintId} className={styles.fact}>
                <dt className={styles.factLabel}>
                  <button
                    type="button"
                    className={styles.sprintButton}
                    onClick={() => onOpenSprint(line.sprintId, current.id)}
                  >
                    Sprint {line.number}
                  </button>
                </dt>
                <dd className={styles.factValue}>{line.text}</dd>
              </div>
            ))}
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{planCopy.remainingLabel}</dt>
              <dd className={styles.factValue}>
                {planCopy.itemsText(current.remaining.items)} ·{' '}
                {planCopy.hoursText(current.remaining.hours)}
              </dd>
            </div>
          </dl>
        </>
      ) : null}
    </section>
  )
}

function NextCard({ model }: { readonly model: PlanModel }) {
  return (
    <section aria-labelledby="plan-next" className={styles.card}>
      <h3 id="plan-next" className={styles.nextTitle}>
        {planCopy.nextTitle}
      </h3>
      {model.next.length === 0 ? (
        <p className={styles.muted}>{planCopy.noNext}</p>
      ) : (
        model.next.map((item) => (
          <div key={item.id} className={styles.nextItem}>
            <span className={styles.nextName}>{item.label}</span>
            <span className={styles.nextText}>{item.description}</span>
          </div>
        ))
      )}
    </section>
  )
}
