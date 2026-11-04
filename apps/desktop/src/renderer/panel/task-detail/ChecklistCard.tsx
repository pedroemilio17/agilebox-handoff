import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ChecklistItemDto, GetTaskDto } from '@agilebox/contract'
import { IconButton, ProgressBar, TextField, Toast } from '@agilebox/ui'
import { panelCopy } from '../copy'
import {
  useAddChecklistItem,
  useMoveChecklistItem,
  useRemoveChecklistItem,
  useRenameChecklistItem,
  useToggleChecklistItem,
} from './use-task-detail'
import styles from './TaskDetailView.module.css'

/** Mesmo limite do contrato (`CHECKLIST_MAX_ITEMS`). */
const CHECKLIST_MAX_ITEMS = 50
/** Mesmo limite do contrato (`CHECKLIST_TITLE_MAX_LENGTH`). */
const CHECKLIST_TITLE_MAX_LENGTH = 200

/** Título obrigatório e até 200 caracteres (sem espaços das pontas). */
export function validateChecklistTitle(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return panelCopy.checklistTitleRequired
  if (Array.from(trimmed).length > CHECKLIST_TITLE_MAX_LENGTH)
    return panelCopy.checklistTitleTooLong
  return null
}

export interface ChecklistCardProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
}

export function ChecklistCard({ task, readOnly }: ChecklistCardProps) {
  const taskId = task.id
  const items = task.checklist
  const { done, total } = task.checklistProgress
  const add = useAddChecklistItem(taskId)
  const toggle = useToggleChecklistItem(taskId)
  const rename = useRenameChecklistItem(taskId)
  const remove = useRemoveChecklistItem(taskId)
  const move = useMoveChecklistItem(taskId)
  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const headingId = useId()
  const addFieldId = useId()

  const notifyError = () =>
    setNotice((current) => ({
      id: (current?.id ?? 0) + 1,
      message: panelCopy.checklistSaveError,
    }))

  const closed = task.status === 'done'
  const limitReached = items.length >= CHECKLIST_MAX_ITEMS
  const busy = add.isPending || rename.isPending || remove.isPending || move.isPending

  const submitAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = validateChecklistTitle(draft)
    setAddError(message)
    if (message) return
    add.mutate(draft.trim(), {
      onSuccess: () => {
        setDraft('')
        document.getElementById(addFieldId)?.focus()
      },
      onError: notifyError,
    })
  }

  return (
    <section aria-labelledby={headingId} className={styles.card}>
      <header className={styles.checklistHeader}>
        <h3 id={headingId} className={styles.cardTitle}>
          {panelCopy.checklistCard}
        </h3>
        <span className={styles.checklistCount}>
          {done}/{total}
        </span>
      </header>
      {total > 0 ? (
        <ProgressBar
          className={styles.checklistBar}
          done={done}
          total={total}
          label={panelCopy.checklistProgressLabel}
        />
      ) : null}

      {items.length === 0 ? <p className={styles.helper}>{panelCopy.checklistEmpty}</p> : null}
      {items.length > 0 ? (
        <ul aria-label={panelCopy.checklistList} className={styles.checklistList}>
          {items.map((item, index) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              readOnly={readOnly}
              onToggle={(next) =>
                toggle.mutate({ itemId: item.id, done: next }, { onError: notifyError })
              }
              onRename={(title) =>
                rename.mutate({ itemId: item.id, title }, { onError: notifyError })
              }
              onRemove={() => remove.mutate(item.id, { onError: notifyError })}
              onMove={(position) =>
                move.mutate({ itemId: item.id, position }, { onError: notifyError })
              }
              index={index}
            />
          ))}
        </ul>
      ) : null}

      {busy ? (
        <p role="status" className={styles.helper}>
          {panelCopy.checklistSaving}
        </p>
      ) : null}

      {readOnly ? <p className={styles.helper}>{panelCopy.checklistReadOnly}</p> : null}
      {closed ? <p className={styles.helper}>{panelCopy.checklistClosed}</p> : null}
      {!closed && limitReached ? <p className={styles.helper}>{panelCopy.checklistLimit}</p> : null}
      {!closed && !limitReached ? (
        <form noValidate onSubmit={submitAdd}>
          <TextField
            id={addFieldId}
            label={panelCopy.checklistAddLabel}
            disabled={readOnly}
            value={draft}
            aria-invalid={addError !== null}
            aria-describedby={addError ? `${addFieldId}-error` : undefined}
            onChange={(event) => {
              setDraft(event.currentTarget.value)
              if (addError) setAddError(validateChecklistTitle(event.currentTarget.value))
            }}
          />
          {addError ? (
            <p id={`${addFieldId}-error`} role="alert" className={styles.blockError}>
              {addError}
            </p>
          ) : null}
        </form>
      ) : null}

      {notice ? <Toast key={notice.id} message={notice.message} /> : null}
    </section>
  )
}

interface ChecklistItemRowProps {
  readonly item: ChecklistItemDto
  readonly index: number
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly readOnly: boolean
  readonly onToggle: (done: boolean) => void
  readonly onRename: (title: string) => void
  readonly onRemove: () => void
  readonly onMove: (position: number) => void
}

function ChecklistItemRow({
  item,
  index,
  isFirst,
  isLast,
  readOnly,
  onToggle,
  onRename,
  onRemove,
  onMove,
}: ChecklistItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.title)
  const [error, setError] = useState<string | null>(null)
  // Enter e Esc já encerram a edição; o blur que o desmonte dispara é ignorado.
  const settledRef = useRef(false)
  const errorId = useId()

  const startEdit = () => {
    settledRef.current = false
    setDraft(item.title)
    setError(null)
    setEditing(true)
  }

  const finish = () => {
    settledRef.current = true
    setEditing(false)
    setError(null)
  }

  const commit = (showError: boolean) => {
    if (settledRef.current) return
    const message = validateChecklistTitle(draft)
    if (message) {
      if (showError) {
        setError(message)
        return
      }
      finish()
      return
    }
    const title = draft.trim()
    if (title === item.title) {
      finish()
      return
    }
    settledRef.current = true
    setEditing(false)
    onRename(title)
  }

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    commit(true)
  }

  return (
    <li className={styles.checklistItem}>
      <label className={styles.checklistCheck}>
        <input
          type="checkbox"
          checked={item.done}
          disabled={readOnly}
          onChange={(event) => onToggle(event.currentTarget.checked)}
        />
        <span className={styles.srOnly}>{panelCopy.checklistToggle(item.title)}</span>
      </label>

      {editing ? (
        <form className={styles.checklistEdit} noValidate onSubmit={submitRename}>
          <input
            aria-label={panelCopy.checklistRenameField}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            autoFocus
            className={styles.checklistInput}
            value={draft}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft(event.currentTarget.value)
              if (error) setError(validateChecklistTitle(event.currentTarget.value))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                finish()
              }
            }}
          />
          {error ? (
            <span id={errorId} role="alert" className={styles.blockError}>
              {error}
            </span>
          ) : null}
        </form>
      ) : (
        <button
          type="button"
          aria-label={panelCopy.checklistRename(item.title)}
          className={item.done ? styles.checklistTitleDone : styles.checklistTitle}
          disabled={readOnly}
          onClick={startEdit}
        >
          {item.title}
        </button>
      )}

      {readOnly ? null : (
        <span className={styles.checklistActions}>
          <IconButton
            type="button"
            aria-label={panelCopy.checklistMoveUp(item.title)}
            title="Mover para cima"
            disabled={isFirst}
            onClick={() => onMove(index - 1)}
          >
            <Chevron direction="up" />
          </IconButton>
          <IconButton
            type="button"
            aria-label={panelCopy.checklistMoveDown(item.title)}
            title="Mover para baixo"
            disabled={isLast}
            onClick={() => onMove(index + 1)}
          >
            <Chevron direction="down" />
          </IconButton>
          <IconButton
            type="button"
            aria-label={panelCopy.checklistRemove(item.title)}
            title="Remover"
            onClick={onRemove}
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </IconButton>
        </span>
      )}
    </li>
  )
}

function Chevron({ direction }: { readonly direction: 'up' | 'down' }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === 'up' ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  )
}
