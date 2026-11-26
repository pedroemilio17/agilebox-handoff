import { useState } from 'react'
import { useMutation, useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import type { MeetingOccurrenceDto } from '@agilebox/contract'
import { Skeleton } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { addDays, shiftMonth } from '../../shared/lib/calendar-grid'
import { todayDateOnly } from '../../shared/lib/today'
import { queryKeys } from '../../shared/query/keys'
import { useActor } from '../../shared/session/useActor'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { panelCopy } from '../copy'
import { useSessionUsers } from '../hooks/use-session-users'
import type { PanelView } from '../layout/PanelShell'
import { AGENDA_CATEGORIES, agendaCopy } from './agenda-copy'
import { monthGridDays, periodTitle, weekDays, type AgendaMode } from './agenda-dates'
import { loadAgendaTasks } from './agenda-tasks'
import { UpcomingSection } from './AgendaAside'
import { AgendaCalendar } from './AgendaCalendar'
import { dotClass } from './meeting-format'
import { MeetingModal, type MeetingDraft } from './MeetingModal'
import { RetroActions } from './RetroActions'
import { occurrenceKey } from './meeting-layout'
import styles from './Agenda.module.css'

type FormState =
  | { readonly mode: 'closed' }
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly meeting: MeetingOccurrenceDto }

/** Primeiro e último dia de um mês 'YYYY-MM', para a consulta por intervalo. */
function monthRange(month: string): { rangeStart: string; rangeEnd: string } {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return { rangeStart: `${month}-01`, rangeEnd: `${month}-${String(lastDay).padStart(2, '0')}` }
}

const MODES: readonly { readonly value: AgendaMode; readonly label: string }[] = [
  { value: 'day', label: agendaCopy.day },
  { value: 'week', label: agendaCopy.week },
  { value: 'month', label: agendaCopy.month },
]

export interface AgendaViewProps {
  readonly onOpenTask?: (id: string) => void
  readonly today?: string
  /** Projeto selecionado no painel: o botão "Como funciona" usa o estado dele. */
  readonly selectedProjectId?: string | null
  /** Leva ao quadro, pelo botão "Rever os primeiros passos". */
  readonly onNavigate?: (view: PanelView) => void
}

export function AgendaView({ today = todayDateOnly(), onOpenTask }: AgendaViewProps) {
  // Combinados da retro só com a ferramenta de review e retro; o restante da agenda segue.
  const capabilities = useCapabilities()
  const retroVisible = capabilities.can('reviewRetro:screen')
  const dailyVisible = capabilities.can('checkins:screen')
  const visibleCategories = AGENDA_CATEGORIES.filter((category) => {
    if (category === 'Daily' && !dailyVisible) return false
    if (category === 'Retrospectiva' && !retroVisible) return false
    return true
  })
  const [mode, setMode] = useState<AgendaMode>('week')
  const api = useApi()
  const queryClient = useQueryClient()
  const actor = useActor()
  const users = useSessionUsers()
  const [focusDate, setFocusDate] = useState(today)
  const [form, setForm] = useState<FormState>({ mode: 'closed' })
  /** Ocorrência de Retro aberta na lateral (qualquer pessoa que vê a agenda). */
  const [retroDetail, setRetroDetail] = useState<MeetingOccurrenceDto | null>(null)
  const canManage = actor.capabilities?.canManageMeetings ?? false

  const visibleDays =
    mode === 'day' ? [focusDate] : mode === 'week' ? weekDays(focusDate) : monthGridDays(focusDate)
  const months = [...new Set(visibleDays.map((date) => date.slice(0, 7)))]
  const meetingQueries = useQueries({
    queries: months.map((month) => ({
      queryKey: [...queryKeys.meetings.all, 'month', month],
      queryFn: () => api.meetings.list(monthRange(month)),
    })),
  })
  const meetings = [
    ...new Map(
      meetingQueries
        .flatMap((query) => query.data ?? [])
        .map((meeting) => [occurrenceKey(meeting), meeting]),
    ).values(),
  ]
  const isManager = actor.actor?.role === 'manager'
  const tasks = useQuery({
    queryKey: [...queryKeys.tasks.board(), 'agenda', isManager],
    enabled: actor.actor !== undefined,
    queryFn: () => loadAgendaTasks(api.tasks, isManager),
  })
  const upcoming = useQuery({
    queryKey: [...queryKeys.meetings.all, 'upcoming'],
    queryFn: () => api.meetings.listUpcoming(),
  })

  const step = (direction: 1 | -1) =>
    setFocusDate(
      mode === 'month'
        ? (() => {
            const next = shiftMonth(
              Number(focusDate.slice(0, 4)),
              Number(focusDate.slice(5, 7)) - 1,
              direction,
            )
            return `${next.year}-${String(next.monthIndex + 1).padStart(2, '0')}-01`
          })()
        : addDays(focusDate, direction * (mode === 'day' ? 1 : 7)),
    )

  /** Retros de um dia, na ordem da grade. */
  const retrosOn = (date: string) =>
    meetings
      .filter((meeting) => meeting.kind === 'retro' && meeting.occurrenceDate === date)
      .sort((a, b) => a.time.localeCompare(b.time))
  /** Abre o agendamento (modal) e, se for retro, os combinados dela na lateral. */
  const openMeeting = (meeting: MeetingOccurrenceDto) => {
    if (meeting.kind === 'retro') setRetroDetail(meeting)
    setForm({ mode: 'edit', meeting })
  }
  const nextRetro = (upcoming.data ?? [])
    .filter((meeting) => meeting.kind === 'retro' && meeting.occurrenceDate >= today)
    .sort((a, b) => `${a.occurrenceDate}${a.time}`.localeCompare(`${b.occurrenceDate}${b.time}`))[0]
  const shownRetro = retroDetail ?? nextRetro ?? null
  // Os dados atualizados da ocorrência (contagens) vêm da lista carregada, se estiver nela.
  const retroCurrent = shownRetro
    ? ([...meetings, ...(upcoming.data ?? [])].find(
        (meeting) => occurrenceKey(meeting) === occurrenceKey(shownRetro),
      ) ?? shownRetro)
    : null
  const retroSiblings = retroCurrent ? retrosOn(retroCurrent.occurrenceDate) : []

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all })
  const close = () => setForm({ mode: 'closed' })
  const save = useMutation({
    mutationFn: (draft: MeetingDraft) =>
      form.mode === 'edit'
        ? api.meetings.update({
            meetingId: form.meeting.seriesId,
            changes: { ...draft, participants: [...draft.participants] },
          })
        : api.meetings.create({ ...draft, participants: [...draft.participants] }),
    onSuccess: async () => {
      await refresh()
      close()
    },
  })
  const remove = useMutation({
    mutationFn: (meetingId: string) => api.meetings.delete({ meetingId }),
    onSuccess: async (_result, meetingId) => {
      if (retroDetail?.seriesId === meetingId) setRetroDetail(null)
      await refresh()
      close()
    },
  })
  const editing = form.mode === 'edit' ? form.meeting : null
  const loading = meetingQueries.some((query) => query.isPending)
  const failed = meetingQueries.some((query) => query.isError)

  return (
    <section className={styles.page} aria-label={agendaCopy.title}>
      <header className={styles.pageHead}>
        <div className={styles.pageHeadMain}>
          <h1 className={styles.pageTitle}>{agendaCopy.title}</h1>
          <p className={styles.pageSub}>
            {retroVisible ? agendaCopy.subtitle : agendaCopy.subtitleBasic}
          </p>
        </div>
        <div className={styles.pageHeadActions}>
          {canManage ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ minHeight: 40 }}
              onClick={() => setForm({ mode: 'create' })}
            >
              {agendaCopy.newEvent}
            </button>
          ) : actor.actor === undefined ? null : (
            <span className={styles.badge} title={agendaCopy.readOnlyHint}>
              {agendaCopy.readOnlyBadge}
            </span>
          )}
        </div>
      </header>

      <div className={styles.agendaLayout}>
        <div className={styles.agendaMain}>
          <div className={styles.agendaToolbar}>
            <div className={styles.agendaNav}>
              <button
                type="button"
                className={styles.navBtn}
                aria-label={agendaCopy.previousPeriod}
                onClick={() => step(-1)}
              >
                ‹
              </button>
              <button type="button" className={styles.navBtn} onClick={() => setFocusDate(today)}>
                {agendaCopy.today}
              </button>
              <button
                type="button"
                className={styles.navBtn}
                aria-label={agendaCopy.nextPeriod}
                onClick={() => step(1)}
              >
                ›
              </button>
              <h2 className={styles.periodTitle}>{periodTitle(mode, focusDate)}</h2>
            </div>
            <div className={styles.quietToggle} role="group" aria-label={agendaCopy.viewGroup}>
              {MODES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.quietToggleBtn} ${mode === option.value ? styles.isActive : ''}`}
                  aria-pressed={mode === option.value}
                  onClick={() => setMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.catLegend} aria-label={agendaCopy.legendLabel}>
            {visibleCategories.map((category) => (
              <span key={category} className={styles.catLegendItem}>
                <i className={`${styles.catDot} ${styles[dotClass(category)]}`} />
                {category}
              </span>
            ))}
          </div>

          <div className={styles.stage}>
            {tasks.isError ? (
              <p role="alert" className={styles.alert}>
                Não foi possível carregar os prazos das tarefas.
              </p>
            ) : null}
            {loading ? (
              <div role="status" aria-label="Carregando agenda">
                <Skeleton />
                <Skeleton />
              </div>
            ) : failed ? (
              <p role="alert" className={styles.alert}>
                Não foi possível carregar os agendamentos.
              </p>
            ) : (
              <AgendaCalendar
                mode={mode}
                focusDate={focusDate}
                today={today}
                meetings={meetings}
                tasks={tasks.data ?? []}
                onOpenMeeting={openMeeting}
                onOpenTask={(id) => onOpenTask?.(id)}
              />
            )}
          </div>
        </div>

        <aside className={styles.agendaAside} aria-label={agendaCopy.asideLabel}>
          {upcoming.isPending ? (
            <Skeleton aria-label="Carregando próximos agendamentos" />
          ) : upcoming.isError ? (
            <p role="alert" className={styles.alert}>
              Não foi possível carregar os próximos agendamentos.
            </p>
          ) : (
            <UpcomingSection meetings={upcoming.data ?? []} today={today} onOpen={openMeeting} />
          )}
          {retroVisible ? (
            retroCurrent ? (
              <div className={styles.asideSection}>
                {retroSiblings.length > 1 ? (
                  <div
                    role="group"
                    aria-label={panelCopy.retroActionsOtherRetros}
                    className={styles.retroSwitch}
                  >
                    {retroSiblings.map((sibling) => (
                      <button
                        key={occurrenceKey(sibling)}
                        type="button"
                        aria-pressed={occurrenceKey(sibling) === occurrenceKey(retroCurrent)}
                        onClick={() => setRetroDetail(sibling)}
                      >
                        {sibling.time} {sibling.title}
                      </button>
                    ))}
                  </div>
                ) : null}
                <RetroActions
                  key={occurrenceKey(retroCurrent)}
                  meeting={retroCurrent}
                  today={today}
                  users={users.data ?? []}
                  canManage={canManage}
                />
              </div>
            ) : upcoming.isPending ? null : (
              <section className={styles.asideSection} aria-label={agendaCopy.retroTitle}>
                <div className={styles.asideSectionHead}>
                  <h2>{agendaCopy.retroTitle}</h2>
                  <span className={styles.asideSectionMeta}>{agendaCopy.retroPending(0)}</span>
                </div>
                <p className={styles.helper}>{agendaCopy.retroNone}</p>
              </section>
            )
          ) : null}
        </aside>
      </div>

      {form.mode !== 'closed' ? (
        <MeetingModal
          key={editing ? occurrenceKey(editing) : 'new'}
          meeting={editing}
          date={focusDate}
          users={users.data ?? []}
          canManage={canManage}
          saving={save.isPending || remove.isPending}
          error={save.isError || remove.isError}
          onSave={(draft) => save.mutate(draft)}
          onDelete={() => editing && remove.mutate(editing.seriesId)}
          onClose={close}
        />
      ) : null}
    </section>
  )
}
