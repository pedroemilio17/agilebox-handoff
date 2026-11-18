import { formatHours } from '@agilebox/core'
import type { BurndownDayDto } from '@agilebox/contract'
import { sprintCopy } from './sprint-copy'
import styles from './SprintsView.module.css'

/** Horas em pt-BR com a unidade ("30 h", "1,5 h"). */
function hours(value: number): string {
  return formatHours(Math.round(value * 100))
}

/** Medidor de estimativa da sprint contra a velocidade média das sprints encerradas. */
export function EstimateGauge({
  estimated,
  velocity,
}: {
  readonly estimated: number
  readonly velocity: { readonly average: number | null; readonly count: number }
}) {
  const average = velocity.average
  const max = average === null ? estimated : Math.max(estimated, average)
  const fill = max > 0 ? (estimated / max) * 100 : 0
  const marker = average !== null && max > 0 ? (average / max) * 100 : null
  return (
    <div className={styles.gauge}>
      <div className={styles.gaugeHead}>
        <span className={styles.kicker}>{sprintCopy.estimatedTitle}</span>
        <span className={styles.gaugeValue}>{hours(estimated)}</span>
      </div>
      <div className={styles.gaugeTrack} aria-hidden="true">
        <div className={styles.gaugeFill} style={{ width: `${fill}%` }} />
        {marker === null ? null : (
          <span className={styles.gaugeMarker} style={{ left: `${marker}%` }} />
        )}
      </div>
      <span className={styles.meta}>
        {average === null
          ? sprintCopy.noVelocity
          : sprintCopy.velocityNote(hours(average), velocity.count)}
      </span>
    </div>
  )
}

/** Dia atual da sprint, atraso frente ao ideal e minha miniatura do burndown (SVG 150 x 48). */
export function BurndownSpark({ days }: { readonly days: readonly BurndownDayDto[] }) {
  const width = 150
  const height = 48
  const top = 4
  const span = height - 8
  const max = Math.max(1, ...days.map((day) => day.idealHours))
  const x = (index: number) =>
    days.length > 1 ? 2 + (index * (width - 4)) / (days.length - 1) : width / 2
  const y = (value: number) => top + (1 - value / max) * span
  const ideal = days.map(
    (day, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(day.idealHours)}`,
  )
  const actual = days
    .map((day, index) =>
      day.remainingHours === null
        ? null
        : `${index === 0 ? 'M' : 'L'}${x(index)} ${y(day.remainingHours)}`,
    )
    .filter((part): part is string => part !== null)
    .join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={ideal.join(' ')} className={styles.sparkIdeal} />
      {actual === '' ? null : <path d={actual} className={styles.sparkActual} />}
    </svg>
  )
}

/** Faixa de resumo da sprint ativa: meta, dia, restante e burndown (quando o módulo está ligado). */
export function SprintBand({
  goal,
  remaining,
  total,
  showEstimates,
  pace,
  series,
  onOpenBurndown,
}: {
  readonly goal: string | null
  readonly remaining: number
  readonly total: number
  readonly showEstimates: boolean
  readonly pace: { day: number; total: number; lagDays: number | null } | null
  readonly series: readonly BurndownDayDto[] | null
  readonly onOpenBurndown?: () => void
}) {
  const lag = pace?.lagDays ?? null
  const status =
    lag === null ? null : lag > 0 ? (
      <span className={styles.warn}>{sprintCopy.behindIdeal(lag)}</span>
    ) : (
      <span className={styles.ok}>{sprintCopy.onIdeal}</span>
    )
  const spark =
    series && series.length > 0 ? (
      <span className={styles.sparkRow}>
        <BurndownSpark days={series} />
        {status}
      </span>
    ) : null
  return (
    <section aria-label={sprintCopy.summaryLabel} className={styles.band}>
      <div className={styles.bandGoal}>
        <span className={styles.kicker}>{sprintCopy.goalShort}</span>
        <span className={goal ? styles.bandGoalText : styles.hint}>
          {goal ?? sprintCopy.noGoal}
        </span>
      </div>
      {pace ? (
        <div className={styles.bandStat}>
          <span className={styles.kicker}>{sprintCopy.dayTitle}</span>
          <span className={styles.bigNumber}>
            {pace.day} <small>{sprintCopy.ofTotal(pace.total)}</small>
          </span>
        </div>
      ) : null}
      {showEstimates ? (
        <div className={styles.bandStat}>
          <span className={styles.kicker}>{sprintCopy.remainingTitle}</span>
          <span className={styles.bigNumber}>
            {hours(remaining)} <small>{sprintCopy.ofTotal(hours(total))}</small>
          </span>
        </div>
      ) : null}
      {spark ? (
        onOpenBurndown ? (
          <button
            type="button"
            className={styles.sparkButton}
            aria-label={`${sprintCopy.openBurndown}${lag !== null && lag > 0 ? `: ${sprintCopy.behindIdeal(lag)} do ideal` : ''}`}
            onClick={onOpenBurndown}
          >
            {spark}
          </button>
        ) : (
          spark
        )
      ) : null}
    </section>
  )
}
