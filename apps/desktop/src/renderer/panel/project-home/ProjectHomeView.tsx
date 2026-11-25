import { useMemo } from 'react'
import { Button, EmptyState } from '@agilebox/ui'
import { useQuery } from '@tanstack/react-query'
import {
  diffInDays,
  parseDateOnly,
  TASK_STATUS_LABELS,
  type DateOnly,
  type TaskStatus,
} from '@agilebox/core'
import { todayDateOnly } from '../../shared/lib/today'
import { useApi } from '../../shared/api/ApiProvider'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { queryKeys } from '../../shared/query/keys'
import { useActor } from '../../shared/session/useActor'
import { panelCopy } from '../copy'
import type { PanelView } from '../layout/PanelShell'
import { PageHead } from '../settings/clean-ui'
import { useFlowMetrics } from '../hooks/use-flow-metrics'
import { useSprintList } from '../sprints/use-sprints'
import { useTracking } from '../hooks/use-tracking'
import { daysLeftLabel } from '../tracking/tracking-screen'
import { costValue } from '../tracking/tracking-screen'
import { shortDateLabel } from '../milestones/milestone-rules'
import {
  attentionItems,
  countByStatus,
  highlightTasks,
  HOME_STATUS_ORDER,
  percentOf,
  sprintDaysLeftLabel,
} from './project-home-rules'
import { useProjectHomeBoard, useProjectHomeMembers } from './use-project-home'
import styles from './ProjectHomeView.module.css'

const copy = {
  noProject: 'Escolha um projeto para ver o início.',
  loading: 'Carregando o início do projeto…',
  loadError: 'Não foi possível carregar o início deste projeto.',
  retry: 'Tentar de novo',
  goBoard: 'Ir ao Quadro',
  goBoardShort: 'Quadro',
  externalSub: 'Sem login nem avisos',
  newTask: '+ Nova tarefa',
  kpiLabel: 'Resumo do projeto',
  done: 'Andamento',
  doneSub: (done: number, total: number) => `${done} de ${total} concluídas`,
  leadTime: 'Tempo médio',
  leadTimeSub: 'Da criação à conclusão',
  leadTimeEmpty: 'Sem conclusões recentes',
  milestone: 'Próximo marco',
  milestoneEmpty: 'Nenhum marco pela frente',
  sprint: 'Sprint ativa',
  sprintEmpty: 'Nenhuma sprint em andamento',
  cost: 'Custo acumulado',
  costSub: 'Visão exclusiva do gestor',
  statesTitle: 'Tarefas por estado',
  tasksCount: (count: number) => (count === 1 ? '1 tarefa' : `${count} tarefas`),
  attentionTitle: 'Precisa de atenção',
  attentionEmpty: 'Nada pede atenção agora.',
  highlightsTitle: 'Em destaque neste projeto',
  highlightsEmpty: 'Nenhuma tarefa aberta neste projeto.',
  openTask: 'Abrir',
  backlogLink: 'Ver Backlog →',
  manageLink: 'Gerenciar em Config. e Ferramentas →',
  openBoard: 'Abrir Quadro →',
  attentionNone: 'Nenhum bloqueio ativo no momento',
  attentionMeta: 'Nada pede atenção agora.',
  attentionMore: 'Acesso rápido',
  noExternalEmpty: 'Nenhuma pessoa externa vinculada neste projeto.',
  noDeadline: 'Sem prazo',
  agendaTitle: 'Próximos compromissos',
  agendaEmpty: 'Nenhum compromisso marcado pela frente.',
  agendaLink: 'Abrir Agenda →',
  teamTitle: 'Time do projeto',
  teamEmpty: 'Nenhuma pessoa no projeto.',
  externalTitle: 'Pessoas externas',
  externalEmpty: 'Pessoas externas ainda não aparecem nesta tela.',
  agendaOpen: 'Agenda →',
  leadDaysUnit: (value: number) =>
    `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`,
} as const

const STATUS_CLASS: Record<TaskStatus, string | undefined> = {
  planning: styles.stPlanning,
  todo: styles.stTodo,
  in_progress: styles.stProgress,
  review: styles.stReview,
  done: styles.stDone,
}

export interface ProjectHomeViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  readonly projectName?: string | null
  /** Leva a outras telas (Quadro, Backlog, Agenda) pelos atalhos desta tela. */
  readonly onNavigate?: (view: PanelView) => void
  /** Abre a tarefa no painel. */
  readonly onOpenTask?: (taskId: string) => void
  readonly onNewTask?: () => void
  /** Motivo para desabilitar "Nova tarefa" (ex.: projeto arquivado). */
  readonly newTaskBlockedReason?: string | undefined
}

/**
 * Início do projeto (protótipo `projeto-home.html`): resumo, tarefas por estado, o que precisa de
 * atenção, destaques, próximo marco e sprint, e o time. Só usa dados que a API já entrega; o que
 * ainda não tem leitura aparece como pendência escrita na própria tela.
 */
export function ProjectHomeView({
  projectId,
  projectName = null,
  onNavigate,
  onOpenTask,
  onNewTask,
  newTaskBlockedReason,
}: ProjectHomeViewProps) {
  const capabilities = useCapabilities()
  const milestonesOn = capabilities.showScreen('milestones')
  const sprintsOn = capabilities.showScreen('sprints')
  const flowOn =
    capabilities.showScreen('flowMetrics') && capabilities.canFetch('flowMetrics:screen')
  const board = useProjectHomeBoard(projectId)
  const tracking = useTracking(projectId)
  const sprints = useSprintList(sprintsOn ? projectId : null)
  const flow = useFlowMetrics(flowOn ? projectId : null)
  const members = useProjectHomeMembers(projectId)
  const api = useApi()
  const { actor } = useActor()
  const isManager = actor?.role === 'manager'
  const agendaOn = capabilities.showScreen('agenda')
  const upcoming = useQuery({
    queryKey: [...queryKeys.meetings.all, 'upcoming'],
    enabled: agendaOn && projectId !== null,
    queryFn: () => api.meetings.listUpcoming(),
  })

  const today = useMemo(() => todayDateOnly(), [])
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  if (projectId === null) {
    return (
      <section aria-label={copy.kpiLabel} className={styles.view}>
        <EmptyState title={copy.noProject} />
      </section>
    )
  }

  if (board.isPending) {
    return (
      <section aria-label={copy.kpiLabel} className={styles.view}>
        <p role="status" className={styles.muted}>
          {copy.loading}
        </p>
      </section>
    )
  }

  if (board.isError || !board.data) {
    return (
      <section aria-label={copy.kpiLabel} className={styles.view}>
        <div role="alert" className={styles.errorBox}>
          <p className={styles.error}>{copy.loadError}</p>
          <Button type="button" onClick={() => void board.refetch()}>
            {copy.retry}
          </Button>
        </div>
      </section>
    )
  }

  const tasks = board.data.tasks
  const counts = countByStatus(tasks)
  const total = HOME_STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0)
  const done = counts.done
  const activeSprint = sprints.data?.find((sprint) => sprint.status === 'active') ?? null
  const trackingData = tracking.data
  const nextMilestone = trackingData?.nextMilestone ?? null
  const realizedCost = trackingData?.summary.realizedCost ?? null
  const attention = attentionItems(tasks, board.data.wipColumns, today, timeZone)
  const highlights = highlightTasks(tasks, 4)
  const upcomingMeetings = (agendaOn ? (upcoming.data ?? []) : []).slice(0, 3)
  const goTo = (view: PanelView) => onNavigate?.(view)

  return (
    <section aria-label={projectName ?? copy.kpiLabel} className={styles.view}>
      <PageHead
        title={projectName ?? copy.kpiLabel}
        actions={
          <>
            <Button type="button" onClick={() => goTo('projects')}>
              {copy.goBoard}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={newTaskBlockedReason !== undefined}
              title={newTaskBlockedReason}
              onClick={() => onNewTask?.()}
            >
              {copy.newTask}
            </Button>
          </>
        }
      />

      <section aria-label={copy.kpiLabel} className={styles.kpiStrip}>
        <KpiCell
          label={copy.done}
          value={`${percentOf(done, total)}%`}
          sub={copy.doneSub(done, total)}
        />
        {flowOn && flow.data ? (
          <KpiCell
            label={copy.leadTime}
            value={
              flow.data.leadDays === null
                ? copy.leadTimeEmpty
                : copy.leadDaysUnit(flow.data.leadDays)
            }
            sub={flow.data.leadDays === null ? '' : copy.leadTimeSub}
          />
        ) : null}
        {milestonesOn && trackingData ? (
          <KpiCell
            label={copy.milestone}
            value={nextMilestone ? nextMilestone.title : copy.milestoneEmpty}
            sub={
              nextMilestone
                ? `${shortDateLabel(nextMilestone.dueOn)} · ${daysLeftLabel(nextMilestone.daysLeft)}`
                : ''
            }
          />
        ) : null}
        {sprintsOn && sprints.data ? (
          <KpiCell
            label={copy.sprint}
            value={activeSprint ? activeSprint.label : copy.sprintEmpty}
            sub={
              activeSprint
                ? sprintDaysLeftLabel(diffInDays(today, parseDateOnly(activeSprint.plannedEnd)))
                : ''
            }
          />
        ) : null}
        {trackingData?.costEnabled && realizedCost !== null ? (
          <KpiCell label={copy.cost} value={costValue(realizedCost)} sub={copy.costSub} />
        ) : null}
      </section>

      <div className={styles.split}>
        <section aria-labelledby="home-states" className={styles.block}>
          <div className={styles.secHead}>
            <h2 id="home-states" className={styles.secTitle}>
              {copy.statesTitle}
            </h2>
            <span className={styles.secMeta}>{copy.tasksCount(total)}</span>
          </div>
          <div className={styles.stateBar} aria-hidden="true">
            {HOME_STATUS_ORDER.map((status) => {
              const width = percentOf(counts[status], total)
              return width > 0 ? (
                <span
                  key={status}
                  className={`${styles.stateSeg} ${STATUS_CLASS[status]}`}
                  style={{ width: `${width}%` }}
                />
              ) : null
            })}
          </div>
          <ul className={styles.list}>
            {HOME_STATUS_ORDER.map((status) => {
              const count = counts[status]
              const pct = percentOf(count, total)
              const label = TASK_STATUS_LABELS[status]
              return (
                <li key={status}>
                  <button
                    type="button"
                    className={styles.stateRow}
                    aria-label={`${label}, ${copy.tasksCount(count)}`}
                    onClick={() => goTo('projects')}
                  >
                    <span className={styles.stateName}>
                      <span
                        className={`${styles.dot} ${STATUS_CLASS[status]}`}
                        aria-hidden="true"
                      />
                      {label}
                    </span>
                    <span className={styles.miniTrack} aria-hidden="true">
                      <span className={styles.miniFill} style={{ width: `${pct}%` }} />
                    </span>
                    <span className={styles.rowNum} aria-hidden="true">
                      {count} · {pct}%
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="home-attention" className={styles.block}>
          <div className={styles.secHead}>
            <h2 id="home-attention" className={styles.secTitle}>
              {copy.attentionTitle}
            </h2>
            <span className={styles.secMeta}>{copy.attentionMore}</span>
          </div>
          <ul className={styles.list}>
            {attention.length === 0 ? (
              <li>
                <button type="button" className={styles.row} onClick={() => goTo('projects')}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>
                      <span className={`${styles.dot} ${styles.dotOk}`} aria-hidden="true" />
                      {copy.attentionNone}
                    </span>
                    <span className={styles.rowMeta}>{copy.attentionMeta}</span>
                  </span>
                  <span className={styles.rowAction} aria-hidden="true">
                    {copy.openBoard}
                  </span>
                </button>
              </li>
            ) : (
              attention.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => (item.taskId ? onOpenTask?.(item.taskId) : goTo('projects'))}
                  >
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>
                        <span
                          className={`${styles.dot} ${item.tone === 'danger' ? styles.dotDanger : styles.dotWarning}`}
                          aria-hidden="true"
                        />
                        {item.title}
                      </span>
                      <span className={styles.rowMeta}>{item.meta}</span>
                    </span>
                    <span className={styles.rowAction} aria-hidden="true">
                      {item.taskId ? copy.openTask : copy.goBoardShort} →
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className={styles.split}>
        <section aria-labelledby="home-highlights" className={styles.block}>
          <div className={styles.secHead}>
            <h2 id="home-highlights" className={styles.secTitle}>
              {copy.highlightsTitle}
            </h2>
            {capabilities.showScreen('backlog') ? (
              <button type="button" className={styles.secLink} onClick={() => goTo('backlog')}>
                {copy.backlogLink}
              </button>
            ) : null}
          </div>
          {highlights.length === 0 ? (
            <p className={styles.muted}>{copy.highlightsEmpty}</p>
          ) : (
            <ul className={styles.list}>
              {highlights.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => onOpenTask?.(task.id)}
                  >
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>
                        <span className={styles.code}>{task.key}</span>
                        {task.title}
                      </span>
                      <span className={styles.rowMeta}>{highlightMeta(task)}</span>
                    </span>
                    <span className={styles.rowAction} aria-hidden="true">
                      {copy.openTask} →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="home-agenda" className={styles.block}>
          <div className={styles.secHead}>
            <h2 id="home-agenda" className={styles.secTitle}>
              {copy.agendaTitle}
            </h2>
            {capabilities.showScreen('agenda') ? (
              <button type="button" className={styles.secLink} onClick={() => goTo('agenda')}>
                {copy.agendaLink}
              </button>
            ) : null}
          </div>
          {upcomingMeetings.length === 0 ? (
            <p className={styles.muted}>{copy.agendaEmpty}</p>
          ) : (
            <ul className={styles.list}>
              {upcomingMeetings.map((meeting) => (
                <li key={`${meeting.seriesId}-${meeting.occurrenceDate}`}>
                  <button type="button" className={styles.row} onClick={() => goTo('agenda')}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>
                        <span className={`${styles.dot} ${styles.dotMuted}`} aria-hidden="true" />
                        {meetingWhen(meeting.occurrenceDate, meeting.time, today)} · {meeting.title}
                      </span>
                      <span className={styles.rowMeta}>
                        {meeting.time} – {meeting.occurrenceEndTime}
                      </span>
                    </span>
                    <span className={styles.rowAction} aria-hidden="true">
                      {copy.agendaOpen}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className={styles.split}>
        <section aria-label={copy.teamTitle} className={styles.block}>
          <div className={styles.secHead}>
            <h2 className={styles.secTitle}>{copy.teamTitle}</h2>
            {isManager ? (
              <button type="button" className={styles.secLink} onClick={() => goTo('modules')}>
                {copy.manageLink}
              </button>
            ) : null}
          </div>
          {members.data && members.data.length > 0 ? (
            <ul className={styles.team}>
              {members.data.map((member) => (
                <li key={member.id} className={styles.person}>
                  <span className={styles.avatar} aria-hidden="true">
                    {member.initials}
                  </span>
                  <span className={styles.personText}>
                    <span className={styles.personName}>{member.name}</span>
                    <span className={styles.personRole}>
                      {member.role === 'manager'
                        ? panelCopy.roleManager
                        : panelCopy.roleCollaborator}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>{copy.teamEmpty}</p>
          )}
        </section>

        <section aria-label={copy.externalTitle} className={styles.block}>
          <div className={styles.secHead}>
            <h2 className={styles.secTitle}>{copy.externalTitle}</h2>
            <span className={styles.secMeta}>{copy.externalSub}</span>
          </div>
          <p className={styles.muted}>{copy.externalEmpty}</p>
        </section>
      </div>
    </section>
  )
}

function highlightMeta(task: {
  readonly status: TaskStatus
  readonly blockedAt: string | null
  readonly deadline: string | null
}): string {
  const state = task.blockedAt !== null ? 'Bloqueada' : TASK_STATUS_LABELS[task.status]
  return task.deadline ? `${state} · ${shortDateLabel(task.deadline)}` : state
}

/** "Hoje · 09:30", "Amanhã · 09:30" ou "24 nov · 09:30". */
function meetingWhen(date: string, time: string, today: DateOnly): string {
  const diff = diffInDays(today, parseDateOnly(date))
  const day = diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : shortDateLabel(date)
  return `${day} · ${time}`
}

function KpiCell({
  label,
  value,
  sub,
}: {
  readonly label: string
  readonly value: string
  readonly sub: string
}) {
  return (
    <div className={styles.kpiCell}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
      {sub ? <span className={styles.kpiSub}>{sub}</span> : null}
    </div>
  )
}
