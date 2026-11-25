import { useState, type KeyboardEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from '@agilebox/contract'
import type { DashboardSummaryFormat } from '@agilebox/contract'
import { ExportMenu, Skeleton } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { todayDateOnly } from '../../shared/lib/today'
import { panelCopy } from '../copy'
import { DailyDialog } from './DailyDialog'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { useSessionUsers } from '../hooks/use-session-users'
import { useNoticeOnError } from './use-notice-on-error'
import { dashboardCopy } from './dashboard-copy'
import type { DashboardInsights } from './dashboard-format'
import { KpiStrip, kpisOf } from './KpiStrip'
import { NeedsList } from './NeedsList'
import { RoleGate } from './RoleGate'
import { StateDistribution } from './StateDistribution'
import { ProjectCard } from './ProjectCard'
import { TeamDailyDialog } from './TeamDailyDialog'
import { TeamTable } from './TeamTable'
import type { DashboardException } from './TeamTable'
import { UpdatesTab } from './UpdatesTab'
import { feedEntries } from './updates-feed'
import type { FeedActionHandlers } from './updates-feed'
import styles from './Dashboard.module.css'

export interface DashboardViewProps extends FeedActionHandlers {
  readonly onOpenProjects: (user: DashboardInsights['team'][number]['user']) => void
  /** Selo de parada, vencida ou bloqueada da equipe: abre o quadro com o filtro. */
  readonly onOpenException?: (exception: DashboardException) => void
  /** Tela completa de Atualizações (filtros por tipo, projeto e visão), a partir da aba. */
  readonly onOpenUpdates: () => void
  /** Avisos do painel (toast): resumo salvo ou falha na exportação. */
  readonly onNotice?: (message: string, tone?: 'default' | 'warning') => void
  /** Falso mostra a guarda educativa do colaborador no lugar do painel. Padrão: gestor. */
  readonly isManager?: boolean
  /** "Ir para o meu Quadro", na guarda do colaborador. */
  readonly onOpenBoard?: () => void
}

const SUMMARY_FORMATS: readonly { value: DashboardSummaryFormat; label: string }[] = [
  { value: 'md', label: panelCopy.exportSummaryMarkdown },
  { value: 'csv', label: panelCopy.exportSummaryCsv },
]

type DashView = 'overview' | 'updates'
const TABS: readonly { id: DashView; label: string }[] = [
  { id: 'overview', label: dashboardCopy.overviewTab },
  { id: 'updates', label: dashboardCopy.updatesTab },
]

export function DashboardView({
  onOpenProjects,
  onOpenException,
  onOpenProject,
  onOpenTask,
  onOpenUpdates,
  onNotice,
  isManager = true,
  onOpenBoard,
}: DashboardViewProps) {
  const [tab, setTab] = useState<DashView>('overview')
  const [dailyOf, setDailyOf] = useState<{ userId: string; name: string } | null>(null)
  const [teamDailyOpen, setTeamDailyOpen] = useState(false)
  const api = useApi()
  const capabilities = useCapabilities()
  const dailyVisible = capabilities.can('checkins:screen')
  const dailyFetch = capabilities.canFetch('checkins:screen')
  const blockedVisible = capabilities.can('impediments:passive')
  const loadVisible = capabilities.can('estimates.hours:passive')
  const wipVisible = capabilities.can('wip:passive')
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: () => api.dashboard.get(),
    enabled: isManager,
  })
  // Valor/hora por pessoa: o servidor só entrega o de todos ao gestor (os demais veem o próprio).
  const sessionUsers = useSessionUsers()
  // Daily de hoje por pessoa. Data local, enviada pelo renderer; recarrega ao abrir o dashboard.
  const today = todayDateOnly()
  const dailyStatus = useQuery({
    queryKey: queryKeys.daily.forDate(today),
    queryFn: () => api.daily.listForDate({ date: today }),
    // Sem a ferramenta de check-ins o backend recusa a consulta: não faz a chamada.
    enabled: dailyFetch && isManager,
  })
  useNoticeOnError(dailyStatus.isError, panelCopy.dailyListError, onNotice)
  const saveSummary = useMutation({
    mutationFn: (input: { format: DashboardSummaryFormat; period: string }) =>
      api.dashboard.saveSummary(input),
    // Cancelar o diálogo do sistema (saved: false) não mostra nada.
    onSuccess: (result) => {
      if (result.saved) onNotice?.(panelCopy.exportSummarySaved)
    },
    onError: (error) =>
      onNotice?.(
        error instanceof ApiError && error.code === 'FORBIDDEN'
          ? panelCopy.forbidden
          : panelCopy.exportSummaryError,
        'warning',
      ),
  })

  const head = (actions: boolean, data?: DashboardInsights) => (
    <header className={styles.pageHead}>
      <div className={styles.pageHeadMain}>
        <h1 className={styles.pageTitle}>{dashboardCopy.title}</h1>
        <p className={styles.pageSub}>{dashboardCopy.subtitle}</p>
      </div>
      {actions ? (
        <div className={styles.pageHeadActions}>
          <div className={styles.viewSwitch} role="tablist" aria-label={dashboardCopy.switchLabel}>
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`dash-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`dash-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                className={`${styles.viewButton} ${tab === item.id ? styles.viewButtonActive : ''}`}
                onClick={() => setTab(item.id)}
                onKeyDown={onTabKeyDown}
              >
                {item.label}
              </button>
            ))}
          </div>
          {data ? (
            <ExportMenu
              label={panelCopy.exportSummary}
              ariaLabel={panelCopy.exportSummaryAria}
              options={SUMMARY_FORMATS}
              busy={saveSummary.isPending}
              busyLabel={panelCopy.exportSummaryBusy}
              onSelect={(format) => saveSummary.mutate({ format, period: data.weekStart })}
            />
          ) : null}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!dailyVisible}
            title={dailyVisible ? undefined : dashboardCopy.dailySummaryOff}
            onClick={() => setTeamDailyOpen(true)}
          >
            {dashboardCopy.dailySummary}
          </button>
        </div>
      ) : null}
    </header>
  )

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next: DashView = tab === 'overview' ? 'updates' : 'overview'
    setTab(next)
    document.getElementById(`dash-tab-${next}`)?.focus()
  }

  if (!isManager)
    return (
      <div className={styles.view}>
        {head(false)}
        <RoleGate onOpenBoard={onOpenBoard} />
      </div>
    )
  if (dashboard.isPending)
    return (
      <div className={styles.view} role="status" aria-label={panelCopy.dashboardLoading}>
        <Skeleton />
        <Skeleton />
      </div>
    )
  if (dashboard.isError || !dashboard.data.insights)
    return <p role="alert">{panelCopy.dashboardError}</p>
  const data = dashboard.data.insights
  const needs = feedEntries(data).needs.filter((entry) => wipVisible || entry.filter !== 'wip')
  const dailyDone = new Map((dailyStatus.data ?? []).map((item) => [item.userId, item.done]))
  const rates = sessionUsers.data
    ? new Map(sessionUsers.data.map((user) => [user.id, user.defaultRate]))
    : undefined
  return (
    <div className={styles.view}>
      {head(true, data)}

      {tab === 'overview' ? (
        <div
          className={styles.body}
          role="tabpanel"
          id="dash-panel-overview"
          aria-labelledby="dash-tab-overview"
        >
          <KpiStrip kpis={kpisOf(data)} />

          <div className={styles.split}>
            <StateDistribution
              distribution={dashboard.data.distribution}
              cycleDays={data.cycleDays}
            />
            <section aria-labelledby="needs-title">
              <div className={styles.secHead}>
                <h2 id="needs-title" className={styles.secTitle}>
                  {dashboardCopy.needsTitle}
                </h2>
                <span className={styles.secMeta}>{dashboardCopy.needsMeta(needs.length)}</span>
              </div>
              <NeedsList entries={needs} onOpenProject={onOpenProject} onOpenTask={onOpenTask} />
            </section>
          </div>

          <section aria-labelledby="projects-title" className={styles.projectsSection}>
            <div className={styles.secHead}>
              <h2 id="projects-title" className={styles.secTitle}>
                {dashboardCopy.projectsTitle}
              </h2>
              <span className={styles.secMeta}>
                {dashboardCopy.projectsMeta(data.projects.length)}
              </span>
            </div>
            {data.projects.length === 0 ? (
              <p className={styles.emptyLine}>{panelCopy.dashboardEmpty}</p>
            ) : (
              <div className={styles.projectsGrid}>
                {data.projects.map((card) => (
                  <ProjectCard key={card.id} card={card} onOpenProject={onOpenProject} />
                ))}
              </div>
            )}
          </section>

          <TeamTable
            team={data.team}
            daily={{ visible: dailyVisible, loading: dailyStatus.isPending, done: dailyDone }}
            blockedVisible={blockedVisible}
            loadVisible={loadVisible}
            rates={rates}
            onOpenProjects={onOpenProjects}
            onOpenException={onOpenException}
            onOpenDaily={(userId, name) => setDailyOf({ userId, name })}
          />
          {dailyStatus.isError ? (
            <p className={styles.caption}>
              {panelCopy.dailyListError}{' '}
              <button
                type="button"
                className={styles.inlineButton}
                onClick={() => void dailyStatus.refetch()}
              >
                {panelCopy.dailyRetry}
              </button>
            </p>
          ) : null}
        </div>
      ) : (
        <div role="tabpanel" id="dash-panel-updates" aria-labelledby="dash-tab-updates">
          <UpdatesTab
            updates={data.updates}
            people={data.team.map((member) => member.user)}
            onOpenTask={onOpenTask}
            onOpenAdvanced={onOpenUpdates}
          />
        </div>
      )}

      {dailyOf && dailyVisible ? (
        <DailyDialog
          userId={dailyOf.userId}
          userName={dailyOf.name}
          date={today}
          onClose={() => setDailyOf(null)}
          onNotice={onNotice}
        />
      ) : null}
      {teamDailyOpen && dailyVisible ? (
        <TeamDailyDialog
          date={today}
          people={(dailyStatus.data ?? []).map((item) => ({
            userId: item.userId,
            name: item.userName,
            done: item.done,
          }))}
          loading={dailyStatus.isPending}
          onOpenTask={onOpenTask}
          onClose={() => setTeamDailyOpen(false)}
        />
      ) : null}
    </div>
  )
}
