import { useEffect, useId, useRef, useState } from 'react'
import type { MeetingDto, SessionUserDto } from '@agilebox/contract'
import type { MeetingKind } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { AGENDA_CATEGORIES, agendaCopy, type AgendaCategory } from './agenda-copy'
import styles from './Agenda.module.css'
import { categoryOf, kindOfCategory } from './meeting-format'

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

export interface MeetingModalProps {
  readonly meeting: MeetingDto | null
  /** Data inicial de um agendamento novo. */
  readonly date: string
  readonly users: readonly SessionUserDto[]
  /** Só o gestor cria e edita; os demais apenas visualizam. */
  readonly canManage: boolean
  readonly saving: boolean
  readonly error: boolean
  readonly onSave: (draft: MeetingDraft) => void
  readonly onDelete: () => void
  readonly onClose: () => void
}

/** Modal "Novo / Detalhes / Visualizar agendamento" (design `#ag-event-modal`). */
export function MeetingModal({
  meeting,
  date,
  users,
  canManage,
  saving,
  error,
  onSave,
  onDelete,
  onClose,
}: MeetingModalProps) {
  const ids = useId()
  const dialogRef = useRef<HTMLFormElement>(null)
  const [title, setTitle] = useState(meeting?.title ?? '')
  const [category, setCategory] = useState<AgendaCategory>(
    meeting ? categoryOf(meeting) : 'Planejamento',
  )
  const [fieldDate, setFieldDate] = useState(meeting?.date ?? date)
  const [time, setTime] = useState(meeting?.time ?? '10:00')
  const [endTime, setEndTime] = useState(meeting?.endTime ?? '')
  const [repeats, setRepeats] = useState(meeting?.recurrence === 'weekly')
  const [until, setUntil] = useState(meeting?.recurrenceUntil ?? '')
  const [participants, setParticipants] = useState<readonly string[]>(meeting?.participants ?? [])
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const first = dialogRef.current?.querySelector<HTMLElement>(
      canManage ? 'input:not([disabled])' : 'button',
    )
    first?.focus()
    return () => {
      if (previous?.isConnected) previous.focus()
    }
  }, [canManage])

  const endError = endTime !== '' && endTime <= time ? panelCopy.meetingEndError : null
  const untilError =
    repeats && until !== '' && until < fieldDate ? panelCopy.meetingUntilError : null
  const canSave =
    canManage &&
    title.trim() !== '' &&
    fieldDate !== '' &&
    time !== '' &&
    endError === null &&
    untilError === null &&
    !saving
  const seriesEdit = meeting?.recurrence === 'weekly'
  const heading = !meeting
    ? agendaCopy.modalNew
    : canManage
      ? agendaCopy.modalDetails
      : agendaCopy.modalView
  const headingId = `${ids}-titulo`
  const readOnly = !canManage

  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSave) return
          onSave({
            title: title.trim(),
            date: fieldDate,
            time,
            endTime: endTime === '' ? null : endTime,
            kind: kindOfCategory(category),
            recurrence: repeats ? 'weekly' : 'none',
            recurrenceUntil: repeats && until !== '' ? until : null,
            participants,
          })
        }}
      >
        <div className={styles.modalHeader}>
          <h3 id={headingId}>{heading}</h3>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label={agendaCopy.modalClose}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${ids}-title`}>
              {agendaCopy.fieldTitle}
            </label>
            <input
              id={`${ids}-title`}
              type="text"
              className={styles.input}
              placeholder={agendaCopy.fieldTitlePlaceholder}
              required
              disabled={readOnly}
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${ids}-category`}>
                {agendaCopy.fieldCategory}
              </label>
              <select
                id={`${ids}-category`}
                className={styles.select}
                disabled={readOnly}
                value={category}
                onChange={(event) => setCategory(event.currentTarget.value as AgendaCategory)}
              >
                {AGENDA_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${ids}-date`}>
                {agendaCopy.fieldDate}
              </label>
              <input
                id={`${ids}-date`}
                type="date"
                className={styles.input}
                required
                disabled={readOnly}
                value={fieldDate}
                onChange={(event) => setFieldDate(event.currentTarget.value)}
              />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${ids}-time`}>
                {agendaCopy.fieldTime}
              </label>
              <input
                id={`${ids}-time`}
                type="time"
                className={styles.input}
                required
                disabled={readOnly}
                value={time}
                onChange={(event) => setTime(event.currentTarget.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${ids}-end`}>
                {agendaCopy.fieldEnd}
              </label>
              <input
                id={`${ids}-end`}
                type="time"
                className={styles.input}
                disabled={readOnly}
                value={endTime}
                aria-invalid={endError !== null}
                aria-describedby={endError ? `${ids}-end-error` : undefined}
                onChange={(event) => setEndTime(event.currentTarget.value)}
              />
            </div>
          </div>
          {endError ? (
            <p id={`${ids}-end-error`} className={styles.fieldError}>
              {endError}
            </p>
          ) : null}
          <fieldset className={styles.participants}>
            <legend>{panelCopy.meetingParticipants}</legend>
            {users.map((user) => (
              <label key={user.id} className={styles.check}>
                <input
                  type="checkbox"
                  disabled={readOnly}
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
              disabled={readOnly}
              checked={repeats}
              onChange={(event) => setRepeats(event.currentTarget.checked)}
            />
            {panelCopy.meetingRepeat}
          </label>
          {repeats ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${ids}-until`}>
                {panelCopy.meetingUntil}
              </label>
              <input
                id={`${ids}-until`}
                type="date"
                className={styles.input}
                disabled={readOnly}
                value={until}
                aria-invalid={untilError !== null}
                aria-describedby={`${ids}-until-note`}
                onChange={(event) => setUntil(event.currentTarget.value)}
              />
              {untilError ? (
                <p id={`${ids}-until-note`} className={styles.fieldError}>
                  {untilError}
                </p>
              ) : until === '' ? (
                <p id={`${ids}-until-note`} className={styles.helper}>
                  {panelCopy.meetingUntilHint}
                </p>
              ) : null}
            </div>
          ) : null}
          {seriesEdit ? <p className={styles.notice}>{panelCopy.seriesNotice}</p> : null}
          {error ? (
            <p role="alert" className={styles.alert}>
              {panelCopy.meetingError}
            </p>
          ) : null}
        </div>
        <div className={styles.modalFooter}>
          {canManage && meeting && confirmingDelete ? (
            <div role="group" aria-label={panelCopy.confirmDeleteSeries} className={styles.confirm}>
              <p>{panelCopy.confirmDeleteSeries}</p>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={saving}
                onClick={onDelete}
              >
                {panelCopy.deleteSeries}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => setConfirmingDelete(false)}
              >
                {panelCopy.keepSeries}
              </button>
            </div>
          ) : canManage && meeting ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger} ${styles.deleteBtn}`}
              disabled={saving}
              onClick={() => (seriesEdit ? setConfirmingDelete(true) : onDelete())}
            >
              {agendaCopy.remove}
            </button>
          ) : null}
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>
            {agendaCopy.modalClose}
          </button>
          {canManage ? (
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={!canSave}
            >
              {agendaCopy.save}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
