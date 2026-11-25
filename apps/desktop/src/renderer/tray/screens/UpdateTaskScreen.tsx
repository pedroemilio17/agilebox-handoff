import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from '@agilebox/core'
import { ReadOnlyBadge } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { queryKeys } from '../../shared/query/keys'
import { useActor } from '../../shared/session/useActor'
import { isBlockedTask } from '../../shared/lib/task-signals'
import { useTaskDetail } from '../../panel/task-detail/use-task-detail'
import { useDefinitionOfDoneGate } from '../../shared/definition-of-done/use-definition-of-done-gate'
import { isDefinitionOfDoneNotConfirmed } from '../../shared/definition-of-done/definition-of-done'
import { trayCopy } from '../copy'
import { formatHours, logActorHours } from '../log-hours'
import { StatusDot } from '../StatusDot'
import { BackButton, OpenPanelButton, TrayHeader } from '../TrayHeader'
import styles from '../Tray.module.css'

export interface UpdateTaskScreenProps {
  readonly taskId: string
  readonly onSaved: () => void
  readonly onBack: () => void
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-11-24" vira "24 nov", como o "Prazo" do protótipo. */
function shortDate(deadline: string | null): string {
  if (!deadline) return trayCopy.updOpenEnded
  const month = MONTHS[Number(deadline.slice(5, 7)) - 1]
  return `${Number(deadline.slice(8, 10))} ${month ?? ''}`.trim()
}

export function UpdateTaskScreen({ taskId, onSaved, onBack }: UpdateTaskScreenProps) {
  const api = useApi()
  const actor = useActor()
  const queryClient = useQueryClient()
  const capabilities = useCapabilities()
  const detail = useTaskDetail(taskId)
  const definitionGate = useDefinitionOfDoneGate()
  const task = detail.data
  const [status, setStatus] = useState<TaskStatus>('planning')
  const [addedHours, setAddedHours] = useState(0)
  const [note, setNote] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [subtaskDone, setSubtaskDone] = useState<Record<string, boolean>>({})
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [dirtyOpen, setDirtyOpen] = useState(false)
  const keepRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    void api.tasks.recordOpen({ taskId }).catch(() => undefined)
  }, [api, taskId])

  const showBlockedNow = capabilities.can('impediments:screen')
  useEffect(() => {
    if (!task || loadedId === task.id) return
    setLoadedId(task.id)
    setStatus(task.status)
    setAddedHours(0)
    setNote(showBlockedNow ? (task.blockedReason ?? '') : '')
    setBlocked(isBlockedTask(task))
    setSubtaskDone(Object.fromEntries(task.checklist.map((item) => [item.id, item.done])))
  }, [loadedId, task, showBlockedNow])

  useEffect(() => {
    if (dirtyOpen) keepRef.current?.focus()
  }, [dirtyOpen])

  const showSubtasks = capabilities.can('subtasks:screen')
  const showBlocked = showBlockedNow
  const initialNote = showBlocked ? (task?.blockedReason ?? '') : ''
  const wasBlocked = task ? isBlockedTask(task) : false

  const dirty = Boolean(
    task &&
    loadedId === task.id &&
    (status !== task.status ||
      addedHours !== 0 ||
      note !== initialNote ||
      (showBlocked && blocked !== wasBlocked) ||
      task.checklist.some((item) => (subtaskDone[item.id] ?? item.done) !== item.done)),
  )

  const save = useMutation({
    mutationFn: async (confirmedDefinitionItemIds: readonly string[]) => {
      if (!task) return
      for (const item of task.checklist) {
        const done = subtaskDone[item.id] ?? item.done
        if (done !== item.done) await api.tasks.checklist.toggle({ taskId, itemId: item.id, done })
      }
      if (addedHours > 0 && actor.actor)
        await logActorHours(api, { taskId, userId: actor.actor.userId, hours: addedHours })
      const text = note.trim()
      if (showBlocked && blocked && !wasBlocked) {
        await api.tasks.block({
          taskId,
          reason: (text || trayCopy.updBlockedDefaultReason).slice(0, 280),
        })
      } else if (showBlocked && !blocked && wasBlocked) {
        await api.tasks.unblock({
          taskId,
          ...(text && note !== initialNote ? { resolution: text.slice(0, 280) } : {}),
        })
      } else if (text && note !== initialNote) {
        await api.tasks.comments.add({ taskId, body: text })
      }
      if (status !== task.status)
        await api.tasks.move({
          taskId,
          status,
          ...(confirmedDefinitionItemIds.length > 0
            ? { confirmedDefinitionItemIds: [...confirmedDefinitionItemIds] }
            : {}),
        })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
      onSaved()
    },
  })

  const requestBack = () => {
    if (dirty) setDirtyOpen(true)
    else onBack()
  }

  const header = (
    <TrayHeader
      left={
        <>
          <BackButton iconOnly label={trayCopy.backHome} onClick={requestBack} />
          <span className={styles.updTaskId}>{task?.key ?? ''}</span>
        </>
      }
      actions={<OpenPanelButton label={trayCopy.openTaskInPanel} />}
    />
  )

  if (detail.isPending)
    return (
      <>
        {header}
        <p role="status" className={styles.mutedLine}>
          {trayCopy.loadingTask}
        </p>
      </>
    )
  if (detail.isError || !task)
    return (
      <>
        {header}
        <p role="alert" className={styles.errorText}>
          {trayCopy.taskError}
        </p>
      </>
    )

  const readOnly = task.readOnly
  const responsible = task.participations
    .filter((participation) => participation.role === 'responsible')
    .map((participation) => participation.participantName)
    .join(', ')
  const baseHours =
    task.actualHours ?? task.participations.reduce((sum, item) => sum + item.hours, 0)
  const doneCount = task.checklist.filter((item) => subtaskDone[item.id] ?? item.done).length

  const submit = () => {
    if (readOnly || save.isPending) return
    if (status === 'done' && task.status !== 'done') {
      // Concluir na bandeja passa pela mesma conferência; cancelar devolve o estado anterior.
      definitionGate.conclude({
        projectId: task.projectId,
        taskLabel: `${task.key} · ${task.title}`,
        returnTo: TASK_STATUS_LABELS[task.status],
        items: task.projectDefinitionOfDone,
        definitionOfDoneCount: task.projectDefinitionOfDone.length,
        complete: (confirmedDefinitionItemIds) => save.mutateAsync([...confirmedDefinitionItemIds]),
        onCancel: () => setStatus(task.status),
      })
      return
    }
    save.mutate([])
  }

  return (
    <>
      {header}
      <div className={`${styles.body} ${styles.updBody}`}>
        <div className={styles.updHeader}>
          <span className={styles.updKicker}>{task.projectName}</span>
          <h2 className={styles.updHeading}>{task.title}</h2>
          <span className={styles.updSubmeta}>
            {trayCopy.updResponsible}: {responsible || trayCopy.noResponsible} ·{' '}
            {trayCopy.updDeadline}: {shortDate(task.deadline)}
          </span>
          {readOnly ? <ReadOnlyBadge /> : null}
        </div>

        <div className={styles.cleanSection}>
          <label className={styles.groupLabel} htmlFor="upd-status-select">
            {trayCopy.updStatus}
          </label>
          <div className={styles.stateSelectWrap}>
            <StatusDot status={status} large />
            <select
              id="upd-status-select"
              className={styles.stateSelect}
              aria-label={trayCopy.updStatusAria}
              disabled={readOnly}
              value={status}
              onChange={(event) => setStatus(event.currentTarget.value as TaskStatus)}
            >
              {TASK_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {TASK_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showSubtasks ? (
          <div className={styles.cleanSection}>
            <div className={styles.groupLabel}>
              <span>{trayCopy.updSubtasks}</span>
              <span>{task.checklist.length ? `${doneCount}/${task.checklist.length}` : '0'}</span>
            </div>
            <div className={styles.subtaskList}>
              {task.checklist.length === 0 ? (
                <div className={styles.mutedLine}>{trayCopy.updNoSubtasks}</div>
              ) : (
                task.checklist.map((item) => {
                  const done = subtaskDone[item.id] ?? item.done
                  return (
                    <label
                      key={item.id}
                      className={`${styles.subtaskRow} ${done ? styles.subtaskDone : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        disabled={readOnly}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked
                          setSubtaskDone((current) => ({ ...current, [item.id]: checked }))
                        }}
                      />
                      <span>{item.title}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        ) : null}

        <div className={styles.cleanSection}>
          <div className={styles.hoursRow}>
            <div>
              <span className={styles.groupLabel}>{trayCopy.updHours}</span>
              <strong className={styles.hoursTotal} aria-live="polite">
                {formatHours(baseHours + addedHours)}
              </strong>
            </div>
            <div className={styles.hoursButtons}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
                disabled={readOnly}
                onClick={() => setAddedHours((current) => current + 0.5)}
              >
                +0,5h
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
                disabled={readOnly}
                onClick={() => setAddedHours((current) => current + 1)}
              >
                +1h
              </button>
            </div>
          </div>
        </div>

        <div className={styles.cleanSection}>
          <label className={styles.groupLabel} htmlFor="upd-note-input">
            {showBlocked ? trayCopy.updNote : trayCopy.updNoteOnly}
          </label>
          <textarea
            id="upd-note-input"
            className={`${styles.textarea} ${styles.noteField}`}
            rows={2}
            placeholder={trayCopy.updNotePlaceholder}
            disabled={readOnly}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
          {showBlocked ? (
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                disabled={readOnly}
                checked={blocked}
                onChange={(event) => setBlocked(event.currentTarget.checked)}
              />
              <span>{trayCopy.updBlocked}</span>
            </label>
          ) : null}
        </div>
        {save.isError && !isDefinitionOfDoneNotConfirmed(save.error) ? (
          <p role="alert" className={styles.errorText}>
            {trayCopy.saveError}
          </p>
        ) : null}
      </div>

      <footer className={styles.fixedFooter}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={readOnly || save.isPending}
          onClick={submit}
        >
          {trayCopy.updSave}
        </button>
      </footer>

      {dirtyOpen ? (
        <div
          className={styles.dirtyOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={trayCopy.dirtyTitle}
        >
          <div className={styles.dirtyBox}>
            <h3>{trayCopy.dirtyTitle}</h3>
            <p>
              Você alterou a tarefa <strong>{task.key}</strong> e ainda não salvou. Deseja descartar
              ou continuar editando?
            </p>
            <div className={styles.dirtyActions}>
              <button
                ref={keepRef}
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setDirtyOpen(false)}
              >
                {trayCopy.dirtyKeep}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => {
                  setDirtyOpen(false)
                  onBack()
                }}
              >
                {trayCopy.dirtyDiscard}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {definitionGate.dialog}
    </>
  )
}
