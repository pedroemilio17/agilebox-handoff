import { useState } from 'react'
import { useMutation, useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import type { MeetingOccurrenceDto } from '@agilebox/contract'
import { Button, SegmentedControl, Skeleton } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { monthKey, shiftMonth, addDays } from '../../shared/lib/calendar-grid'
import { todayDateOnly } from '../../shared/lib/today'
import { queryKeys } from '../../shared/query/keys'
import { useActor } from '../../shared/session/useActor'
import { panelCopy } from '../copy'
import { useSessionUsers } from '../hooks/use-session-users'
import { WeekCalendar, agendaDays } from './WeekCalendar'
import { Calendar } from './Calendar'
import { MeetingForm, type MeetingDraft } from './MeetingForm'
import { UpcomingList } from './UpcomingList'
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

export interface AgendaViewProps {
  readonly onOpenTask?: (id: string) => void
  readonly today?: string
}

export function AgendaView({ today = todayDateOnly(), onOpenTask }: AgendaViewProps) {
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('week')
  const [showDeadlines, setShowDeadlines] = useState(true)
  const api = useApi()
  const queryClient = useQueryClient()
  const actor = useActor()
  const users = useSessionUsers()
  const [{ year, monthIndex }, setMonth] = useState(() => ({
    year: Number(today.slice(0, 4)),
    monthIndex: Number(today.slice(5, 7)) - 1,
  }))
  const [selectedDate, setSelectedDate] = useState(today)
  const [form, setForm] = useState<FormState>({ mode: 'closed' })
  /** Ocorrência de Retro aberta no painel de combinados (qualquer pessoa que vê a agenda). */
  const [retroDetail, setRetroDetail] = useState<MeetingOccurrenceDto | null>(null)
  const canManage = actor.capabilities?.canManageMeetings ?? false

  const days = agendaDays(selectedDate, mode === 'day' ? 'day' : 'week')
  const months =
    mode === 'month'
      ? [monthKey(year, monthIndex)]
      : [...new Set(days.map((date) => date.slice(0, 7)))]
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
  const tasks = useQuery({
    queryKey: queryKeys.tasks.board(),
    queryFn: () => api.tasks.listBoard({}),
  })
  const selectDate = (date: string) => {
    setSelectedDate(date)
    setMonth({ year: Number(date.slice(0, 4)), monthIndex: Number(date.slice(5, 7)) - 1 })
  }
  /** Retros de um dia, na ordem da grade. */
  const retrosOn = (date: string) =>
    meetings
      .filter((meeting) => meeting.kind === 'retro' && meeting.occurrenceDate === date)
      .sort((a, b) => a.time.localeCompare(b.time))
  /** Abre a retro no painel de combinados; quem gerencia também abre o formulário. */
  const openMeeting = (meeting: MeetingOccurrenceDto) => {
    if (meeting.kind === 'retro') setRetroDetail(meeting)
    if (canManage) setForm({ mode: 'edit', meeting })
  }
  // Os dados atualizados da ocorrência (contagens) vêm da lista carregada, se estiver nela.
  const retroCurrent = retroDetail
    ? (meetings.find((meeting) => occurrenceKey(meeting) === occurrenceKey(retroDetail)) ??
      retroDetail)
    : null
  const retroSiblings = retroCurrent ? retrosOn(retroCurrent.occurrenceDate) : []
  const upcoming = useQuery({
    queryKey: [...queryKeys.meetings.all, 'upcoming'],
    queryFn: () => api.meetings.listUpcoming(),
  })

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

  const open = form.mode !== 'closed'
  const editing = form.mode === 'edit' ? form.meeting : null

  return (
    <div
      className={styles.view}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          close()
        }
      }}
    >
      <div className={styles.calendarArea}>
        <div className={styles.viewControls}>
          <SegmentedControl
            aria-label="Visualização da agenda"
            options={[
              { value: 'day', label: 'Dia' },
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mês' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <label>
            <input
              type="checkbox"
              checked={showDeadlines}
              onChange={(event) => setShowDeadlines(event.currentTarget.checked)}
            />
            Mostrar prazos de tarefas
          </label>
        </div>
        {showDeadlines && tasks.isError && (
          <p role="alert">Não foi possível carregar os prazos das tarefas.</p>
        )}
        {showDeadlines && tasks.isPending && <Skeleton aria-label="Carregando prazos" />}
        {meetingQueries.some((query) => query.isPending) ? (
          <div role="status" aria-label="Carregando agenda">
            <Skeleton />
            <Skeleton />
          </div>
        ) : meetingQueries.some((query) => query.isError) ? (
          <p role="alert">Não foi possível carregar os agendamentos.</p>
        ) : mode === 'month' ? (
          <Calendar
            year={year}
            monthIndex={monthIndex}
            today={today}
            selectedDate={selectedDate}
            meetings={meetings}
            onSelectDate={(date) => {
              setSelectedDate(date)
              const month = {
                year: Number(date.slice(0, 4)),
                monthIndex: Number(date.slice(5, 7)) - 1,
              }
              if (month.year !== year || month.monthIndex !== monthIndex) setMonth(month)
              // No mês, o dia escolhido abre a primeira retro dele (as outras aparecem como troca).
              const [firstRetro] = retrosOn(date)
              if (firstRetro) setRetroDetail(firstRetro)
            }}
            onPreviousMonth={() => setMonth(shiftMonth(year, monthIndex, -1))}
            onNextMonth={() => setMonth(shiftMonth(year, monthIndex, 1))}
          />
        ) : (
          <WeekCalendar
            days={days}
            today={today}
            selectedDate={selectedDate}
            meetings={meetings}
            tasks={tasks.data?.tasks ?? []}
            showDeadlines={showDeadlines}
            canEdit={canManage}
            onSelectDate={selectDate}
            onPrevious={() => selectDate(addDays(selectedDate, mode === 'day' ? -1 : -7))}
            onNext={() => selectDate(addDays(selectedDate, mode === 'day' ? 1 : 7))}
            onEdit={openMeeting}
            onOpenTask={(id) => onOpenTask?.(id)}
          />
        )}
      </div>
      <aside className={styles.side}>
        {upcoming.isPending ? (
          <Skeleton aria-label="Carregando próximos agendamentos" />
        ) : upcoming.isError ? (
          <p role="alert">Não foi possível carregar os próximos agendamentos.</p>
        ) : (
          <UpcomingList
            meetings={upcoming.data ?? []}
            compact={open}
            users={users.data ?? []}
            canEdit={canManage}
            onEdit={openMeeting}
          />
        )}
        {retroCurrent ? (
          <div className={styles.retroPanel}>
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
        ) : null}
        <Button
          type="button"
          variant="primary"
          disabled={!canManage}
          onClick={() => setForm({ mode: 'create' })}
        >
          {panelCopy.newMeeting}
        </Button>
        {canManage ? null : <p className={styles.helper}>{panelCopy.managerOnly}</p>}
        <div className={`${styles.formWrap} ${open ? styles.formOpen : ''}`} aria-hidden={!open}>
          <div className={styles.formInner}>
            {open ? (
              <MeetingForm
                resetKey={editing ? occurrenceKey(editing) : 'new'}
                meeting={editing}
                date={selectedDate}
                users={users.data ?? []}
                saving={save.isPending || remove.isPending}
                error={save.isError || remove.isError}
                onSave={(draft) => save.mutate(draft)}
                onDelete={() => editing && remove.mutate(editing.seriesId)}
                onCancel={close}
              />
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  )
}
