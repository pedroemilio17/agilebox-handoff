import { useEffect, useId, useState } from 'react'
import type { MeetingDto, SessionUserDto } from '@agilebox/contract'
import { Button, MEETING_KIND_LABELS, SegmentedControl, type MeetingKind } from '@agilebox/ui'
import { panelCopy } from '../copy'
import styles from './Agenda.module.css'

export type Recurrence = 'none' | 'weekly'

export interface MeetingDraft {
  readonly title: string
  readonly date: string
  readonly time: string
  /** Fim opcional: null quando não informado (vale 1 hora). */
  readonly endTime: string | null
  readonly kind: MeetingKind
  readonly recurrence: Recurrence
  /** Data final opcional da repetição semanal. */
  readonly recurrenceUntil: string | null
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

const KIND_OPTIONS = [
  { value: 'meeting', label: MEETING_KIND_LABELS.meeting },
  { value: 'review', label: MEETING_KIND_LABELS.review },
  { value: 'retro', label: MEETING_KIND_LABELS.retro },
] as const

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
  const ids = useId()
  const [title, setTitle] = useState('')
  const [fieldDate, setFieldDate] = useState(date)
  const [time, setTime] = useState('09:00')
  const [endTime, setEndTime] = useState('')
  const [kind, setKind] = useState<MeetingKind>('meeting')
  const [repeats, setRepeats] = useState(false)
  const [until, setUntil] = useState('')
  const [participants, setParticipants] = useState<readonly string[]>([])
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    setTitle(meeting?.title ?? '')
    setFieldDate(meeting?.date ?? date)
    setTime(meeting?.time ?? '09:00')
    setEndTime(meeting?.endTime ?? '')
    setKind(meeting?.kind ?? 'meeting')
    setRepeats(meeting?.recurrence === 'weekly')
    setUntil(meeting?.recurrenceUntil ?? '')
    setParticipants(meeting?.participants ?? [])
    setConfirmingDelete(false)
    // `date` só vale ao abrir; depois o dia selecionado atualiza o campo de data abaixo.
  }, [resetKey])

  useEffect(() => {
    if (!meeting) setFieldDate(date)
  }, [date, meeting])

  const endError = endTime !== '' && endTime <= time ? panelCopy.meetingEndError : null
  const untilError =
    repeats && until !== '' && until < fieldDate ? panelCopy.meetingUntilError : null
  const canSave =
    title.trim() !== '' &&
    fieldDate !== '' &&
    time !== '' &&
    endError === null &&
    untilError === null &&
    !saving
  const seriesEdit = meeting?.recurrence === 'weekly'
  const endId = `${ids}-fim-erro`
  const untilId = `${ids}-ate-erro`
  const untilHintId = `${ids}-ate-dica`

  return (
    <form
      className={styles.form}
      aria-label={meeting ? panelCopy.saveMeeting : panelCopy.newMeeting}
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSave) return
        onSave({
          title: title.trim(),
          date: fieldDate,
          time,
          endTime: endTime === '' ? null : endTime,
          kind,
          recurrence: repeats ? 'weekly' : 'none',
          recurrenceUntil: repeats && until !== '' ? until : null,
          participants,
        })
      }}
    >
      <SegmentedControl
        aria-label={panelCopy.meetingKind}
        options={KIND_OPTIONS}
        value={kind}
        onChange={(value) => setKind(value)}
      />
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
        <label className={styles.field}>
          <span>{panelCopy.meetingEnd}</span>
          <input
            type="time"
            value={endTime}
            aria-invalid={endError !== null}
            aria-describedby={endError ? endId : undefined}
            onChange={(event) => setEndTime(event.currentTarget.value)}
          />
        </label>
      </div>
      {endError ? (
        <p id={endId} className={styles.fieldError}>
          {endError}
        </p>
      ) : null}
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
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={repeats}
          onChange={(event) => setRepeats(event.currentTarget.checked)}
        />
        {panelCopy.meetingRepeat}
      </label>
      {repeats ? (
        <div className={styles.field}>
          <label className={styles.field}>
            <span>{panelCopy.meetingUntil}</span>
            <input
              type="date"
              value={until}
              aria-invalid={untilError !== null}
              aria-describedby={untilError ? untilId : untilHintId}
              onChange={(event) => setUntil(event.currentTarget.value)}
            />
          </label>
          {untilError ? (
            <p id={untilId} className={styles.fieldError}>
              {untilError}
            </p>
          ) : until === '' ? (
            <p id={untilHintId} className={styles.helper}>
              {panelCopy.meetingUntilHint}
            </p>
          ) : null}
        </div>
      ) : null}
      {seriesEdit ? <p className={styles.notice}>{panelCopy.seriesNotice}</p> : null}
      {error ? <p role="alert">{panelCopy.meetingError}</p> : null}
      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={!canSave}>
          {panelCopy.saveMeeting}
        </Button>
        {meeting && confirmingDelete ? (
          <div role="group" aria-label={panelCopy.confirmDeleteSeries} className={styles.confirm}>
            <p>{panelCopy.confirmDeleteSeries}</p>
            <Button type="button" disabled={saving} onClick={onDelete}>
              {panelCopy.deleteSeries}
            </Button>
            <Button type="button" onClick={() => setConfirmingDelete(false)}>
              {panelCopy.keepSeries}
            </Button>
          </div>
        ) : meeting ? (
          <Button
            type="button"
            disabled={saving}
            onClick={() => (seriesEdit ? setConfirmingDelete(true) : onDelete())}
          >
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
