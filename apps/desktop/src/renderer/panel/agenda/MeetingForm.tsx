import { useEffect, useState } from 'react'
import type { MeetingDto, SessionUserDto } from '@agilebox/contract'
import { Button } from '@agilebox/ui'
import { panelCopy } from '../copy'
import styles from './Agenda.module.css'

export interface MeetingDraft {
  readonly title: string
  readonly date: string
  readonly time: string
  readonly participants: readonly string[]
}

export interface MeetingFormProps {
  /** Reabre o formulário (limpa os campos) quando muda. */
  readonly resetKey: string
  readonly meeting: MeetingDto | null
  readonly date: string
  readonly users: readonly SessionUserDto[]
  readonly saving: boolean
  readonly error: boolean
  readonly onSave: (draft: MeetingDraft) => void
  readonly onDelete: () => void
  readonly onCancel: () => void
}

export function MeetingForm({
  resetKey,
  meeting,
  date,
  users,
  saving,
  error,
  onSave,
  onDelete,
  onCancel,
}: MeetingFormProps) {
  const [title, setTitle] = useState('')
  const [fieldDate, setFieldDate] = useState(date)
  const [time, setTime] = useState('09:00')
  const [participants, setParticipants] = useState<readonly string[]>([])

  useEffect(() => {
    setTitle(meeting?.title ?? '')
    setFieldDate(meeting?.date ?? date)
    setTime(meeting?.time ?? '09:00')
    setParticipants(meeting?.participants ?? [])
    // `date` só vale ao abrir; depois o dia selecionado atualiza o campo de data abaixo.
  }, [resetKey])

  useEffect(() => {
    if (!meeting) setFieldDate(date)
  }, [date, meeting])

  const canSave = title.trim() !== '' && fieldDate !== '' && time !== '' && !saving

  return (
    <form
      className={styles.form}
      aria-label={meeting ? panelCopy.saveMeeting : panelCopy.newMeeting}
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) onSave({ title: title.trim(), date: fieldDate, time, participants })
      }}
    >
      <label className={styles.field}>
        <span>{panelCopy.meetingTitle}</span>
        <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
      </label>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>{panelCopy.meetingDate}</span>
          <input
            type="date"
            value={fieldDate}
            onChange={(event) => setFieldDate(event.currentTarget.value)}
          />
        </label>
        <label className={styles.field}>
          <span>{panelCopy.meetingTime}</span>
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.currentTarget.value)}
          />
        </label>
      </div>
      <fieldset className={styles.participants}>
        <legend>{panelCopy.meetingParticipants}</legend>
        {users.map((user) => (
          <label key={user.id} className={styles.check}>
            <input
              type="checkbox"
              checked={participants.includes(user.id)}
              onChange={(event) => {
                const checked = event.currentTarget.checked
                setParticipants((current) =>
                  checked ? [...current, user.id] : current.filter((id) => id !== user.id),
                )
              }}
            />
            {user.name}
          </label>
        ))}
      </fieldset>
      {error ? <p role="alert">{panelCopy.meetingError}</p> : null}
      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={!canSave}>
          {panelCopy.saveMeeting}
        </Button>
        {meeting ? (
          <Button type="button" disabled={saving} onClick={onDelete}>
            {panelCopy.deleteMeeting}
          </Button>
        ) : null}
        <Button type="button" onClick={onCancel}>
          {panelCopy.cancel}
        </Button>
      </div>
    </form>
  )
}
