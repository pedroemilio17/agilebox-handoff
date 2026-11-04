import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { addDays, differenceInCalendarDays, format, getISOWeek, parseISO } from 'date-fns'
import { TASK_STATUS_LABELS } from '@agilebox/core'
import { ApiError } from '@agilebox/contract'
import type { DashboardSummaryFormat } from '@agilebox/contract'
import {
  Avatar,
  BarChart,
  Eyebrow,
  ExportMenu,
  MetricTile,
  SignalBadge,
  Skeleton,
  Sparkline,
} from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { panelCopy } from '../copy'
import type { CollaboratorStat } from './types'
import styles from './Dashboard.module.css'

export interface DashboardViewProps {
  readonly onOpenProjects: (user: CollaboratorStat['user']) => void
  readonly onOpenException?: (exception: 'aging' | 'overdue' | 'blocked') => void
  readonly onOpenTask?: (taskId: string) => void
  /** Avisos do painel (toast): resumo salvo ou falha na exportação. */
  readonly onNotice?: (message: string, tone?: 'default' | 'warning') => void
}

const SUMMARY_FORMATS: readonly { value: DashboardSummaryFormat; label: string }[] = [
  { value: 'md', label: panelCopy.exportSummaryMarkdown },
  { value: 'csv', label: panelCopy.exportSummaryCsv },
]
const days = (value: number | null) =>
  value === null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}d`

export function DashboardView({
  onOpenProjects,
  onOpenException,
  onOpenTask,
  onNotice,
}: DashboardViewProps) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null)
  const api = useApi()
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: () => api.dashboard.get(),
  })
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
  const period = data.weeks.find((item) => item.start === selectedWeek)
  const adherence = period ? (period.upToDatePercentage ?? null) : data.upToDatePercentage
  const cycle = period ? (period.cycleDays ?? null) : data.cycleDays
  const lead = period ? (period.leadDays ?? null) : data.leadDays
  const throughput = period?.throughput ?? data.throughput
  const index = period ? data.weeks.indexOf(period) : data.weeks.length - 1
  const previous = data.weeks[index - 1]?.upToDatePercentage
  const delta = adherence !== null && previous != null ? Math.round(adherence - previous) : null
  return (
    <div className={styles.view}>
      <header className={styles.period}>
        <select
          aria-label="Semana do dashboard"
          className={styles.weekSelect}
          value={period?.start ?? data.weekStart}
          onChange={(event) => setSelectedWeek(event.currentTarget.value)}
        >
          {data.weeks.map((item) => (
            <option key={item.start} value={item.start}>
              Semana {getISOWeek(parseISO(item.start))} · {format(parseISO(item.start), 'dd/MM')}–
              {format(addDays(parseISO(item.start), 6), 'dd/MM')}
            </option>
          ))}
        </select>
        <div className={styles.periodActions}>
          <span>dados do quadro · atualizado às {format(parseISO(data.updatedAt), 'HH:mm')}</span>
          <ExportMenu
            label={panelCopy.exportSummary}
            ariaLabel={panelCopy.exportSummaryAria}
            options={SUMMARY_FORMATS}
            busy={saveSummary.isPending}
            busyLabel={panelCopy.exportSummaryBusy}
            onSelect={(format) =>
              saveSummary.mutate({ format, period: period?.start ?? data.weekStart })
            }
          />
        </div>
      </header>
      <div className={styles.overview}>
        <section className={styles.panel} aria-label="Quadro em dia">
          <Eyebrow>Quadro em dia</Eyebrow>
          <p className={styles.adoption}>
            {adherence === null ? (
              '—'
            ) : (
              <>
                {Math.round(adherence)}
                <span>%</span>
              </>
            )}
          </p>
          <Sparkline
            label="Quadro em dia nas últimas seis semanas"
            data={data.weeks.slice(0, index + 1).map((item) => ({
              label: `S${getISOWeek(parseISO(item.start))}`,
              value: item.upToDatePercentage ?? null,
            }))}
          />
          <p className={styles.caption}>
            das tarefas ativas foram atualizadas nas últimas 48h
            {delta !== null && ` · ${delta > 0 ? '+' : ''}${delta} pts vs. semana passada`}
          </p>
        </section>
        <div className={styles.exceptions}>
          {data.overWipColumns.length > 0 ? (
            <ul className={styles.wipExceptions} aria-label="Colunas acima do limite">
              {data.overWipColumns.map((column) => (
                <li key={column.status}>
                  <SignalBadge variant="wip">
                    {panelCopy.wipOverLabel(
                      TASK_STATUS_LABELS[column.status],
                      column.count,
                      column.limit,
                    )}
                  </SignalBadge>
                </li>
              ))}
            </ul>
          ) : null}
          <MetricTile
            label="Bloqueadas"
            value={data.blockedCount}
            caption="com motivo registrado"
            signal="danger"
            onClick={() => onOpenException?.('blocked')}
          />
          <MetricTile
            label="Paradas"
            value={data.agingCount}
            caption="há mais de 4 dias"
            onClick={() => onOpenException?.('aging')}
          />
          <MetricTile
            label="Vencidas"
            value={data.overdueCount}
            caption="prazo de entrega passou"
            signal="danger"
            onClick={() => onOpenException?.('overdue')}
          />
        </div>
      </div>
      <div className={styles.overview}>
        <section className={styles.panel} aria-label="Fluxo de seis semanas">
          <Eyebrow>Fluxo · 6 semanas</Eyebrow>
          <div className={styles.flowMetrics}>
            <p>
              <strong>{days(cycle)}</strong>
              <span>tempo de ciclo médio</span>
            </p>
            <p>
              <strong>{days(lead)}</strong>
              <span>do pedido à entrega</span>
            </p>
            <p>
              <strong>{throughput === 0 ? '—' : throughput}</strong>
              <span>concluídas nesta semana</span>
            </p>
          </div>
          {cycle === null && <p className={styles.caption}>sem movimentação nesta semana</p>}
          <BarChart
            label="Concluídas por semana"
            data={data.weeks.map((item) => ({
              label: `S${getISOWeek(parseISO(item.start))}`,
              value: item.throughput,
            }))}
          />
        </section>
        <section className={styles.panel} aria-label="Mudou desde ontem">
          <Eyebrow>Mudou desde ontem</Eyebrow>
          {data.recentChanges.length === 0 ? (
            <p className={styles.caption}>Nenhuma mudança desde ontem.</p>
          ) : (
            <ul className={styles.changeList}>
              {data.recentChanges.map((event) => (
                <li key={event.id}>
                  <button
                    className={styles.change}
                    onClick={() => onOpenTask?.(event.taskId)}
                    type="button"
                  >
                    <Avatar name={event.actorName} />
                    <span>
                      <strong>{event.taskTitle}</strong>
                      <span>
                        {event.actorName}
                        {event.asManager ? ' · Gestor' : ''} {event.text}
                      </span>
                    </span>
                    <time dateTime={event.at}>{format(parseISO(event.at), 'HH:mm')}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className={styles.panel} aria-label="Equipe">
        <Eyebrow>Equipe</Eyebrow>
        <div className={styles.teamScroll}>
          <div className={styles.teamHeader}>
            <span>Pessoa</span>
            <span>Em andamento</span>
            <span>Sinais</span>
            <span>Última atualização</span>
          </div>
          {data.team.length === 0 ? (
            <p className={styles.caption}>Nenhuma tarefa ainda.</p>
          ) : (
            data.team.map((person) => (
              <button
                className={styles.teamRow}
                key={person.user.id}
                type="button"
                aria-label={panelCopy.openProjectsOf(person.user.name)}
                onClick={() => onOpenProjects(person.user)}
              >
                <span className={styles.person}>
                  <Avatar name={person.user.name} />
                  {person.user.name}
                </span>
                <span className={styles.figure}>{person.inProgress}</span>
                <span className={styles.signals}>
                  {person.agingCount > 0 && (
                    <SignalBadge variant="aging">
                      {person.agingCount} {person.agingCount === 1 ? 'parada' : 'paradas'}
                    </SignalBadge>
                  )}
                  {person.overdueCount > 0 && (
                    <SignalBadge variant="overdue">
                      {person.overdueCount} {person.overdueCount === 1 ? 'vencida' : 'vencidas'}
                    </SignalBadge>
                  )}
                  {person.blockedCount > 0 && (
                    <SignalBadge variant="blocked">
                      {person.blockedCount} {person.blockedCount === 1 ? 'bloqueada' : 'bloqueadas'}
                    </SignalBadge>
                  )}
                  {person.agingCount === 0 &&
                    person.overdueCount === 0 &&
                    person.blockedCount === 0 &&
                    '—'}
                </span>
                <span
                  className={`${styles.figure} ${person.lastUpdatedAt && differenceInCalendarDays(parseISO(data.updatedAt), parseISO(person.lastUpdatedAt)) > 2 ? styles.aging : ''}`}
                >
                  {person.lastUpdatedAt
                    ? format(parseISO(person.lastUpdatedAt), 'dd/MM HH:mm')
                    : '—'}
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
