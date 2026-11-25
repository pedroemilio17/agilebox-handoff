import { panelCopy } from '../copy'
import { dashboardCopy } from './dashboard-copy'
import { brl } from './dashboard-format'
import type { DashboardInsights } from './dashboard-format'
import styles from './Dashboard.module.css'

type TeamMember = DashboardInsights['team'][number]
/** Exceções que abrem o quadro filtrado (selos de parada, vencida e bloqueada). */
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
  /** Carga em horas: só com a ferramenta de estimativa de horas ligada (o Básico não tem). */
  readonly loadVisible: boolean
  /**
   * Valor/hora padrão por pessoa, em reais. O servidor só entrega o de todos ao gestor; sem
   * permissão vem `null` e a célula mostra "—". Ausente enquanto carrega.
   */
  readonly rates?: ReadonlyMap<string, number | null> | undefined
  readonly onOpenProjects: (member: TeamMember['user']) => void
  readonly onOpenDaily: (userId: string, name: string) => void
  /** Selo de parada, vencida ou bloqueada abre o quadro com esse filtro. */
  readonly onOpenException?: ((exception: DashboardException) => void) | undefined
}

/** Sinais da pessoa em selos de atenção: dias de parada, vencida e aceite pendente. */
function signalsOf(member: TeamMember) {
  const signals: { key: string; text: string; exception?: DashboardException }[] = []
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
  return signals
}

/**
 * "Colaboradores": tabela aberta (cabeçalho mono em caixa alta, sem borda externa). Pessoa com os
 * projetos dela, em andamento, bloqueadas, sinais, diária, carga, valor/hora e "Abrir quadro →".
 * O contrato ainda não traz tempo médio, horas lançadas nem custo por pessoa (pendência).
 */
export function TeamTable({
  team,
  daily,
  blockedVisible,
  loadVisible,
  rates,
  onOpenProjects,
  onOpenDaily,
  onOpenException,
}: TeamTableProps) {
  const ratesVisible = rates !== undefined && [...rates.values()].some((rate) => rate !== null)
  return (
    <section aria-labelledby="team-title">
      <div className={styles.secHead}>
        <h2 id="team-title" className={styles.secTitle}>
          {dashboardCopy.teamTitle}
        </h2>
        <span className={styles.secMeta}>{dashboardCopy.teamMeta}</span>
      </div>
      {team.length === 0 ? (
        <p className={styles.emptyLine}>{panelCopy.dashboardEmpty}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label={dashboardCopy.teamTableLabel}>
            <thead>
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col" className={styles.num}>
                  Em andamento
                </th>
                {blockedVisible ? (
                  <th scope="col" className={styles.num}>
                    Bloqueadas
                  </th>
                ) : null}
                <th scope="col">Sinais</th>
                {daily.visible ? <th scope="col">Diária de hoje</th> : null}
                {loadVisible ? (
                  <th scope="col" className={styles.num}>
                    Carga (h)
                  </th>
                ) : null}
                {ratesVisible ? (
                  <th scope="col" className={styles.num}>
                    Valor/h (R$)
                  </th>
                ) : null}
                <th scope="col">Ação</th>
              </tr>
            </thead>
            <tbody>
              {team.map((member) => {
                const name = member.user.name
                const done = daily.done.get(member.user.id)
                const signals = signalsOf(member)
                const rate = rates?.get(member.user.id) ?? null
                return (
                  <tr key={member.user.id}>
                    <td>
                      <div className={styles.personCell}>
                        <span className={styles.avatar} aria-hidden="true">
                          {member.user.initials}
                        </span>
                        <div>
                          <div className={styles.personName}>{name}</div>
                          <div className={styles.personRole}>
                            {member.projects.map((project) => project.name).join(', ') || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.num}>{member.inProgress}</td>
                    {blockedVisible ? (
                      <td className={styles.num}>
                        {member.blockedCount > 0 ? (
                          onOpenException ? (
                            <button
                              type="button"
                              className={`${styles.blockedCell} ${styles.rowActionInline}`}
                              aria-label={`${member.blockedCount} ${member.blockedCount === 1 ? 'bloqueada' : 'bloqueadas'}`}
                              onClick={() => onOpenException('blocked')}
                            >
                              <span
                                className={`${styles.dot} ${styles.dotDanger}`}
                                aria-hidden="true"
                              />
                              {member.blockedCount}
                            </button>
                          ) : (
                            <span className={styles.blockedCell}>
                              <span
                                className={`${styles.dot} ${styles.dotDanger}`}
                                aria-hidden="true"
                              />
                              {member.blockedCount}
                            </span>
                          )
                        ) : (
                          <span className={styles.zero}>0</span>
                        )}
                      </td>
                    ) : null}
                    <td>
                      <span className={styles.signals}>
                        {signals.length === 0 ? (
                          <span className={styles.zero}>—</span>
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
                    </td>
                    {daily.visible ? (
                      <td>
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
                      </td>
                    ) : null}
                    {loadVisible ? (
                      <td className={styles.num}>
                        {member.loadHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h
                      </td>
                    ) : null}
                    {ratesVisible ? (
                      <td className={styles.num}>{rate === null ? '—' : brl(rate)}</td>
                    ) : null}
                    <td>
                      <button
                        type="button"
                        className={styles.rowActionInline}
                        aria-label={panelCopy.openProjectsOf(name)}
                        onClick={() => onOpenProjects(member.user)}
                      >
                        {dashboardCopy.openBoard}
                        <span aria-hidden="true"> →</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
