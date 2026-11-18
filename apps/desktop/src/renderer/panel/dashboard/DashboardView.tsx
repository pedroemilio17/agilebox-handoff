import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { addDays, format, getISOWeek, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ApiError } from '@agilebox/contract'
import type { DashboardSummaryFormat } from '@agilebox/contract'
import { ExportMenu, Skeleton } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { todayDateOnly } from '../../shared/lib/today'
import { panelCopy } from '../copy'
import { DailyDialog } from './DailyDialog'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { useNoticeOnError } from './use-notice-on-error'
import { METHOD_NAMES } from './dashboard-format'
import type { DashboardInsights } from './dashboard-format'
import { NeedsList } from './NeedsList'
import { ProjectCard } from './ProjectCard'
import { TeamTable } from './TeamTable'
import type { DashboardException } from './TeamTable'
import { feedEntries } from './updates-feed'
import type { FeedActionHandlers } from './updates-feed'
import { swatchIndexOf } from '../../shared/lib/project-swatch'
import styles from './Dashboard.module.css'

export interface DashboardViewProps extends FeedActionHandlers {
  readonly onOpenProjects: (user: DashboardInsights['team'][number]['user']) => void
  /** Selo de parada, vencida ou bloqueada da equipe: abre o quadro com o filtro. */
  readonly onOpenException?: (exception: DashboardException) => void
  /** Botão "Ver todas as atualizações" da seção "Precisa de você". */
  readonly onOpenUpdates: () => void
  /** Avisos do painel (toast): resumo salvo ou falha na exportação. */
  readonly onNotice?: (message: string, tone?: 'default' | 'warning') => void
}

const SUMMARY_FORMATS: readonly { value: DashboardSummaryFormat; label: string }[] = [
  { value: 'md', label: panelCopy.exportSummaryMarkdown },
  { value: 'csv', label: panelCopy.exportSummaryCsv },
]

const ALL = 'all'

/** "Semana 47 · 17–21 nov": de segunda a sexta, como no desenho. */
function weekLabel(weekStart: string): string {
  const start = parseISO(weekStart)
  const end = addDays(start, 4)
  const month = format(end, 'MMM', { locale: ptBR }).replace('.', '')
  return `Semana ${getISOWeek(start)} · ${format(start, 'dd')}–${format(end, 'dd')} ${month}`
}

export function DashboardView({
  onOpenProjects,
  onOpenException,
  onOpenProject,
  onOpenTask,
  onOpenUpdates,
  onNotice,
}: DashboardViewProps) {
  const [projectFilter, setProjectFilter] = useState<string>(ALL)
  const [methodFilter, setMethodFilter] = useState<string>(ALL)
  const [personFilter, setPersonFilter] = useState<string>(ALL)
  const [dailyOf, setDailyOf] = useState<{ userId: string; name: string } | null>(null)
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
  })
  // Daily de hoje por pessoa. Data local, enviada pelo renderer; recarrega ao abrir o dashboard.
  const today = todayDateOnly()
  const dailyStatus = useQuery({
    queryKey: queryKeys.daily.forDate(today),
    queryFn: () => api.daily.listForDate({ date: today }),
    // Sem a ferramenta de check-ins o backend recusa a consulta: não faz a chamada.
    enabled: dailyFetch,
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
  const methods = [
    ...new Set(data.projects.map((project) => project.method).filter((m) => m !== null)),
  ]
  const projects = data.projects.filter(
    (project) =>
      (projectFilter === ALL || project.id === projectFilter) &&
      (methodFilter === ALL || project.method === methodFilter),
  )
  const needs = feedEntries(data).needs.filter(
    (entry) =>
      (projectFilter === ALL || entry.projectId === projectFilter) &&
      (wipVisible || entry.filter !== 'wip'),
  )
  const team = data.team.filter((member) => personFilter === ALL || member.user.id === personFilter)
  const dailyDone = new Map((dailyStatus.data ?? []).map((item) => [item.userId, item.done]))
  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <span className={styles.week}>{weekLabel(data.weekStart)}</span>
        <span className={styles.spacer} />
        <label className={styles.chip}>
          Projetos:
          <select
            aria-label="Filtrar por projeto"
            className={styles.chipSelect}
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.currentTarget.value)}
          >
            <option value={ALL}>todos</option>
            {data.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <span className={styles.chipCount}>{data.projects.length}</span>
        </label>
        <label className={styles.chip}>
          Metodologia:
          <select
            aria-label="Filtrar por metodologia"
            className={styles.chipSelect}
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.currentTarget.value)}
          >
            <option value={ALL}>todas</option>
            {methods.map((method) => (
              <option key={method} value={method}>
                {METHOD_NAMES[method]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.chip}>
          Pessoa:
          <select
            aria-label="Filtrar por pessoa"
            className={styles.chipSelect}
            value={personFilter}
            onChange={(event) => setPersonFilter(event.currentTarget.value)}
          >
            <option value={ALL}>todas</option>
            {data.team.map((member) => (
              <option key={member.user.id} value={member.user.id}>
                {member.user.name}
              </option>
            ))}
          </select>
        </label>
        {/* Visão de equipe ainda não tem dado: o chip fica estático, como no desenho. */}
        <button type="button" className={styles.chip} disabled>
          Mini-equipe: todas
        </button>
        <ExportMenu
          label={panelCopy.exportSummary}
          ariaLabel={panelCopy.exportSummaryAria}
          options={SUMMARY_FORMATS}
          busy={saveSummary.isPending}
          busyLabel={panelCopy.exportSummaryBusy}
          onSelect={(format) => saveSummary.mutate({ format, period: data.weekStart })}
        />
      </header>

      <section aria-labelledby="needs-title" className={styles.needs}>
        <div className={styles.needsHead}>
          <h2 id="needs-title" className={styles.sectionTitle}>
            Precisa de você
          </h2>
          <span className={styles.count}>{needs.length}</span>
          <span className={styles.spacer} />
          <button type="button" className={styles.linkButton} onClick={onOpenUpdates}>
            Ver todas as atualizações
          </button>
        </div>
        <NeedsList
          entries={needs}
          projectSwatch={swatchIndexOf}
          onOpenProject={onOpenProject}
          onOpenTask={onOpenTask}
        />
      </section>

      <section aria-labelledby="projects-title" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id="projects-title" className={styles.sectionTitle}>
            Projetos
          </h2>
          <span className={styles.caption}>
            Cada um medido pela sua metodologia e resumido em Em dia, Atenção ou Risco, sempre com o
            motivo.
          </span>
        </div>
        {projects.length === 0 ? (
          <p className={styles.emptyLine}>{panelCopy.dashboardEmpty}</p>
        ) : (
          <div className={styles.projects}>
            {projects.map((card) => (
              <ProjectCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </section>

      <TeamTable
        team={team}
        daily={{ visible: dailyVisible, loading: dailyStatus.isPending, done: dailyDone }}
        blockedVisible={blockedVisible}
        loadVisible={loadVisible}
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
      {dailyOf && dailyVisible ? (
        <DailyDialog
          userId={dailyOf.userId}
          userName={dailyOf.name}
          date={today}
          onClose={() => setDailyOf(null)}
          onNotice={onNotice}
        />
      ) : null}
    </div>
  )
}
