import { useState } from 'react'
import { useMutation, useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import type { MeetingDto } from '@agilebox/contract'
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
import styles from './Agenda.module.css'

type FormState =
  | { readonly mode: 'closed' }
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly meeting: MeetingDto }

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
  const canManage = actor.capabilities?.canManageMeetings ?? false

  const days = agendaDays(selectedDate, mode === 'day' ? 'day' : 'week')
  const months =
    mode === 'month'
      ? [monthKey(year, monthIndex)]
      : [...new Set(days.map((date) => date.slice(0, 7)))]
  const meetingQueries = useQueries({
    queries: months.map((month) => ({
      queryKey: [...queryKeys.meetings.all, 'month', month],
      queryFn: () => api.meetings.list({ month }),
    })),
  })
  const meetings = [
    ...new Map(
      meetingQueries.flatMap((query) => query.data ?? []).map((meeting) => [meeting.id, meeting]),
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
            meetingId: form.meeting.id,
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
    onSuccess: async () => {
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
            tasks={tasks.data ?? []}
            showDeadlines={showDeadlines}
            canEdit={canManage}
            onSelectDate={selectDate}
            onPrevious={() => selectDate(addDays(selectedDate, mode === 'day' ? -1 : -7))}
            onNext={() => selectDate(addDays(selectedDate, mode === 'day' ? 1 : 7))}
            onEdit={(meeting) => setForm({ mode: 'edit', meeting })}
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
            onEdit={(meeting) => setForm({ mode: 'edit', meeting })}
          />
        )}
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
                resetKey={editing?.id ?? 'new'}
                meeting={editing}
                date={selectedDate}
                users={users.data ?? []}
                saving={save.isPending || remove.isPending}
                error={save.isError || remove.isError}
                onSave={(draft) => save.mutate(draft)}
                onDelete={() => editing && remove.mutate(editing.id)}
                onCancel={close}
              />
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  )
}
