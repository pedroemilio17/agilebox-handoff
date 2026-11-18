import { Avatar, ProjectSwatch } from '@agilebox/ui'
import { swatchIndexOf } from '../../shared/lib/project-swatch'
import { panelCopy } from '../copy'
import type { DashboardInsights } from './dashboard-format'
import styles from './Dashboard.module.css'

type TeamMember = DashboardInsights['team'][number]
/** Exceções que abrem o quadro filtrado (como antes das exceções virarem selos da equipe). */
export type DashboardException = 'aging' | 'overdue' | 'blocked'

export interface TeamTableProps {
  readonly team: readonly TeamMember[]
  /** Diária de hoje por pessoa (`true` = respondeu). Ausente sem a ferramenta de check-ins. */
  readonly daily: {
    readonly visible: boolean
    readonly loading: boolean
    readonly done: ReadonlyMap<string, boolean>
  }
  readonly blockedVisible: boolean
  /** Carga em horas e a legenda: só com a ferramenta de estimativa de horas ligada (o Básico não tem). */
  readonly loadVisible: boolean
  readonly onOpenProjects: (member: TeamMember['user']) => void
  readonly onOpenDaily: (userId: string, name: string) => void
  /** Selo de parada, vencida ou bloqueada abre o quadro com esse filtro. */
  readonly onOpenException?: ((exception: DashboardException) => void) | undefined
}

/** Sinais da pessoa, em selos de atenção (dias de parada, vencida, aceite pendente, bloqueio). */
function signalsOf(member: TeamMember, blockedVisible: boolean) {
  // Desenho: todos os sinais da equipe usam o mesmo tom de atenção (`.warn`).
  const signals: {
    key: string
    text: string
    exception?: DashboardException
  }[] = []
  if (member.staleDays !== null)
    signals.push({ key: 'stale', text: `Parada ${member.staleDays}d`, exception: 'aging' })
  if (member.overdueDays !== null)
    signals.push({
      key: 'overdue',
      text: `+${member.overdueDays} dias de atraso`,
      exception: 'overdue',
    })
  if (member.acceptancePendingCount > 0)
    signals.push({
      key: 'acceptance',
      text:
        member.acceptancePendingCount === 1
          ? 'Aceite pendente'
          : `${member.acceptancePendingCount} aceites pendentes`,
    })
  if (blockedVisible && member.blockedCount > 0)
    signals.push({
      key: 'blocked',
      text: `${member.blockedCount} ${member.blockedCount === 1 ? 'bloqueada' : 'bloqueadas'}`,
      exception: 'blocked',
    })
  return signals
}

/** "Equipe em todos os projetos": uma linha por pessoa, abre os projetos dela ao clicar. */
export function TeamTable({
  team,
  daily,
  blockedVisible,
  loadVisible,
  onOpenProjects,
  onOpenDaily,
  onOpenException,
}: TeamTableProps) {
  const gridColumns = [
    '1.2fr',
    '2fr',
    '0.8fr',
    '1.4fr',
    ...(daily.visible ? ['1fr'] : []),
    ...(loadVisible ? ['1.3fr'] : []),
  ].join(' ')
  return (
    <section className={styles.team} aria-labelledby="team-title">
      <div className={styles.teamHead}>
        <h2 id="team-title" className={styles.sectionTitle}>
          Equipe em todos os projetos
        </h2>
        <span className={styles.spacer} />
        {loadVisible ? (
          <span className={styles.caption}>
            Carga soma as estimativas de todos os projetos da pessoa
          </span>
        ) : null}
      </div>
      <div className={styles.teamTable}>
        <div className={styles.teamColumns} style={{ gridTemplateColumns: gridColumns }}>
          <span>Pessoa</span>
          <span>Projetos</span>
          <span>Em andamento</span>
          <span>Sinais</span>
          {daily.visible ? <span>Diária de hoje</span> : null}
          {loadVisible ? <span>Carga da semana</span> : null}
        </div>
        {team.length === 0 ? (
          <p className={styles.emptyLine}>{panelCopy.dashboardEmpty}</p>
        ) : (
          team.map((member) => {
            const name = member.user.name
            const done = daily.done.get(member.user.id)
            const signals = signalsOf(member, blockedVisible)
            return (
              <div
                className={`${styles.teamRowItem} ${styles.teamRow}`}
                style={{ gridTemplateColumns: gridColumns }}
                key={member.user.id}
              >
                <button
                  type="button"
                  className={styles.teamRowLink}
                  aria-label={panelCopy.openProjectsOf(name)}
                  onClick={() => onOpenProjects(member.user)}
                />
                <span className={styles.person}>
                  <Avatar name={name} />
                  {name}
                </span>
                <span className={styles.personChips}>
                  {member.projects.map((project) => (
                    <span className={styles.projectChip} key={project.id}>
                      <ProjectSwatch index={swatchIndexOf(project.id)} name={project.name} />
                      {project.name}
                    </span>
                  ))}
                </span>
                <span className={styles.figure}>{member.inProgress}</span>
                <span className={styles.signals}>
                  {signals.length === 0 ? (
                    <span className={styles.noSignal}>—</span>
                  ) : (
                    signals.map((signal) =>
                      signal.exception && onOpenException ? (
                        <button
                          type="button"
                          className={`${styles.signal} ${styles.signalButton}`}
                          key={signal.key}
                          onClick={() => onOpenException(signal.exception!)}
                        >
                          {signal.text}
                        </button>
                      ) : (
                        <span className={styles.signal} key={signal.key}>
                          {signal.text}
                        </span>
                      ),
                    )
                  )}
                </span>
                {daily.visible ? (
                  <span className={styles.dailyCell}>
                    {daily.loading ? (
                      <span className={styles.muted}>{panelCopy.dailyLoading}</span>
                    ) : done === undefined ? (
                      <span className={styles.muted}>—</span>
                    ) : done ? (
                      <>
                        <span className={styles.dailyDone}>✓ respondida</span>
                        <button
                          type="button"
                          className={styles.inlineButton}
                          aria-label={panelCopy.dailyViewOf(name)}
                          onClick={() => onOpenDaily(member.user.id, name)}
                        >
                          {panelCopy.dailyView}
                        </button>
                      </>
                    ) : (
                      <span className={styles.dailyPending}>pendente</span>
                    )}
                  </span>
                ) : null}
                {loadVisible ? (
                  <span className={styles.figure}>
                    {member.loadHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h
                  </span>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
