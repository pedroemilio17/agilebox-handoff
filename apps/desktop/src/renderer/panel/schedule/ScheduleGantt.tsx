import { useId } from 'react'
import type { ScheduleViewDto } from '@agilebox/contract'
import styles from './ScheduleView.module.css'
import {
  barLabel,
  barState,
  buildRows,
  buildTimeScale,
  DAY_WIDTH,
  dependencyLines,
  hasBar,
  milestoneCenter,
  NAME_COLUMN_WIDTH,
  ROW_HEIGHT,
  shortDate,
  todayCenter,
  type ScheduleGroup,
  type ScheduleScale,
  type ScheduleRow,
} from './schedule-screen'

export const ganttCopy = {
  section: 'Gráfico de Gantt',
  region: 'Linha do tempo, role para ver mais datas',
  nameHead: 'Entrega ou tarefa',
  noDates: 'sem datas',
  milestoneLabel: (title: string, dueOn: string) => `Marco: ${title}, ${shortDate(dueOn)}`,
} as const

export interface ScheduleGanttProps {
  readonly range: { readonly start: string; readonly end: string }
  readonly today: string
  readonly scale: ScheduleScale
  readonly groups: readonly ScheduleGroup[]
  readonly view: ScheduleViewDto
}

/** Caminho das setas: reta do fim da predecessora até o início da sucessora, em ângulos retos. */
function pathOf(points: readonly { readonly x: number; readonly y: number }[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x * 100} ${point.y * ROW_HEIGHT}`)
    .join(' ')
}

/**
 * Gantt em HTML e SVG simples. Coluna de nomes fixa, eixo de tempo, barras por tarefa, losangos de
 * marco, traço de "hoje" e setas de dependência. As setas e o traço são decorativos (aria-hidden):
 * a lista abaixo da tela traz a mesma informação.
 */
export function ScheduleGantt({ range, today, scale, groups, view }: ScheduleGanttProps) {
  const markerId = `schedule-arrow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const ts = buildTimeScale(range, scale)
  const rows: ScheduleRow[] = buildRows(groups, view.milestones)
  const lines = dependencyLines(view.dependencies, rows, ts)
  const span = ts.end - ts.start
  const timelineWidth = span * DAY_WIDTH[scale]
  const bodyHeight = rows.length * ROW_HEIGHT
  const todayX = todayCenter(today, ts)
  const fraction = (day: number) => ((day - ts.start) / span) * 100
  const gridTemplate = `${NAME_COLUMN_WIDTH}px ${timelineWidth}px`
  const innerWidth = NAME_COLUMN_WIDTH + timelineWidth

  return (
    <section aria-label={ganttCopy.section} className={styles.ganttCard}>
      <div role="region" aria-label={ganttCopy.region} tabIndex={0} className={styles.scroll}>
        <div className={styles.ganttInner} style={{ width: innerWidth }}>
          <div className={styles.ganttHead} style={{ gridTemplateColumns: gridTemplate }}>
            <div className={styles.nameHead}>{ganttCopy.nameHead}</div>
            <div className={styles.axis}>
              {ts.columns.map((column) => (
                <span
                  key={column.start}
                  className={styles.axisLabel}
                  style={{ left: `${fraction(column.start)}%` }}
                >
                  {column.label}
                </span>
              ))}
            </div>
          </div>

          <div
            className={styles.overlay}
            aria-hidden="true"
            style={{ left: NAME_COLUMN_WIDTH, width: timelineWidth, height: bodyHeight }}
          >
            {ts.columns.slice(1).map((column) => (
              <span
                key={column.start}
                className={styles.gridLine}
                style={{ left: `${fraction(column.start)}%` }}
              />
            ))}
            {todayX === null ? null : (
              <span className={styles.todayLine} style={{ left: `${todayX * 100}%` }} />
            )}
            <svg
              className={styles.depSvg}
              viewBox={`0 0 100 ${Math.max(bodyHeight, 1)}`}
              preserveAspectRatio="none"
              focusable="false"
            >
              <defs>
                <marker
                  id={markerId}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L10,5 L0,10 z" className={styles.arrowHead} />
                </marker>
                <marker
                  id={`${markerId}-conflict`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L10,5 L0,10 z" className={styles.arrowHeadConflict} />
                </marker>
              </defs>
              {lines.map((line) => {
                const d = pathOf(line.points)
                return (
                  <path
                    key={`${line.predecessorId}-${line.successorId}`}
                    d={d}
                    className={styles.depLine}
                    data-conflict={line.conflict ? 'true' : 'false'}
                    markerEnd={line.conflict ? `url(#${markerId}-conflict)` : `url(#${markerId})`}
                  />
                )
              })}
            </svg>
          </div>

          {rows.map((row) => {
            const milestoneX = row.kind === 'milestone' ? milestoneCenter(row.milestone, ts) : null
            return (
              <div
                key={
                  row.kind === 'task'
                    ? row.task.taskId
                    : row.kind === 'milestone'
                      ? `m-${row.index}`
                      : `g-${row.key}`
                }
                className={`${styles.ganttRow} ${row.kind === 'group' ? styles.groupRow : ''}`}
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {row.kind === 'group' ? (
                  <>
                    <div className={`${styles.nameCell} ${styles.nameGroup}`}>
                      {row.code ? <span className={styles.code}>{row.code}</span> : null}
                      <span>{row.title}</span>
                    </div>
                    <div className={styles.timeline} />
                  </>
                ) : row.kind === 'task' ? (
                  <>
                    <div
                      className={`${styles.nameCell} ${row.indented ? styles.nameTaskIndent : styles.nameTask}`}
                    >
                      <span className={styles.key}>{row.task.key}</span>
                      <span>{row.task.title}</span>
                    </div>
                    <div className={styles.timeline} style={{ width: timelineWidth }}>
                      {hasBar(row.task) ? (
                        <span
                          role="img"
                          aria-label={barLabel(row.task)}
                          title={barLabel(row.task)}
                          className={styles.bar}
                          data-state={barState(row.task, today) ?? 'future'}
                          style={{
                            left: `${ts.barGeometry(row.task.startsOn, row.task.deadline).left * 100}%`,
                            width: `${ts.barGeometry(row.task.startsOn, row.task.deadline).width * 100}%`,
                          }}
                        />
                      ) : (
                        <span className={styles.noDates}>{ganttCopy.noDates}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.nameCell}>
                      <span>{row.milestone.title}</span>
                    </div>
                    <div className={styles.timeline} style={{ width: timelineWidth }}>
                      {milestoneX === null ? null : (
                        <>
                          <span
                            role="img"
                            aria-label={ganttCopy.milestoneLabel(
                              row.milestone.title,
                              row.milestone.dueOn,
                            )}
                            className={styles.milestone}
                            style={{ left: `${milestoneX * 100}%` }}
                          />
                          <span
                            className={styles.milestoneLabel}
                            style={{ left: `${milestoneX * 100}%` }}
                          >
                            {shortDate(row.milestone.dueOn)}
                          </span>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
