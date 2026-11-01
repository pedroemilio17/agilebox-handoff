import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MeetingDto } from '@agilebox/contract'
import { Button } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { monthKey, shiftMonth } from '../../shared/lib/calendar-grid'
import { todayDateOnly } from '../../shared/lib/today'
import { queryKeys } from '../../shared/query/keys'
import { useActor } from '../../shared/session/useActor'
import { panelCopy } from '../copy'
import { useSessionUsers } from '../hooks/use-session-users'
import { Calendar } from './Calendar'
import { MeetingForm, type MeetingDraft } from './MeetingForm'
import { UpcomingList } from './UpcomingList'
import styles from './Agenda.module.css'

type FormState =
  | { readonly mode: 'closed' }
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly meeting: MeetingDto }

export interface AgendaViewProps {
  readonly today?: string
}

export function AgendaView({ today = todayDateOnly() }: AgendaViewProps) {
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

  const meetings = useQuery({
    queryKey: [...queryKeys.meetings.all, 'month', monthKey(year, monthIndex)],
    queryFn: () => api.meetings.list({ month: monthKey(year, monthIndex) }),
  })
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
    <div className={styles.view}>
      <Calendar
        year={year}
        monthIndex={monthIndex}
        today={today}
        selectedDate={selectedDate}
        meetings={meetings.data ?? []}
        onSelectDate={(date) => {
          setSelectedDate(date)
          const month = { year: Number(date.slice(0, 4)), monthIndex: Number(date.slice(5, 7)) - 1 }
          if (month.year !== year || month.monthIndex !== monthIndex) setMonth(month)
        }}
        onPreviousMonth={() => setMonth(shiftMonth(year, monthIndex, -1))}
        onNextMonth={() => setMonth(shiftMonth(year, monthIndex, 1))}
      />
      <aside className={styles.side}>
        <UpcomingList
          meetings={upcoming.data ?? []}
          canEdit={canManage}
          onEdit={(meeting) => setForm({ mode: 'edit', meeting })}
        />
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
