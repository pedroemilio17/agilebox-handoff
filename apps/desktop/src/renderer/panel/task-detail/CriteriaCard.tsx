import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { AcceptanceCriterionDto, GetTaskDto } from '@agilebox/contract'
import { IconButton, ProgressBar, TextField, Toast } from '@agilebox/ui'
import { panelCopy } from '../copy'
import {
  useAddCriterion,
  useMoveCriterion,
  useRemoveCriterion,
  useRenameCriterion,
  useToggleCriterion,
} from './use-task-detail'
import styles from './TaskDetailView.module.css'

/** Mesmo limite do contrato (`ACCEPTANCE_TEXT_MAX_LENGTH`, em caracteres). */
const CRITERIA_MAX_ITEMS = 20
const CRITERIA_TEXT_MAX_LENGTH = 200

/** Texto obrigatório e até 200 caracteres (sem espaços das pontas). */
export function validateCriterionText(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return panelCopy.criteriaTextRequired
  if (Array.from(trimmed).length > CRITERIA_TEXT_MAX_LENGTH) return panelCopy.criteriaTextTooLong
  return null
}

export interface CriteriaCardProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
  /** Módulo em encerramento: os critérios existem e seguem editáveis, mas não entra critério novo. */
  readonly windingDown: boolean
}

export function CriteriaCard({ task, readOnly, windingDown }: CriteriaCardProps) {
  const taskId = task.id
  const items = task.criteria ?? []
  const done = items.filter((item) => item.done).length
  const total = items.length
  const add = useAddCriterion(taskId)
  const toggle = useToggleCriterion(taskId)
  const rename = useRenameCriterion(taskId)
  const remove = useRemoveCriterion(taskId)
  const move = useMoveCriterion(taskId)
  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const headingId = useId()
  const addFieldId = useId()

  const notifyError = () =>
    setNotice((current) => ({
      id: (current?.id ?? 0) + 1,
      message: panelCopy.criteriaSaveError,
    }))

  const limitReached = items.length >= CRITERIA_MAX_ITEMS
  const busy = add.isPending || rename.isPending || remove.isPending || move.isPending
  const creating = !windingDown && !limitReached && !readOnly

  const submitAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = validateCriterionText(draft)
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
          {panelCopy.criteriaCard}
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
          label={panelCopy.criteriaProgressLabel}
        />
      ) : null}

      {items.length === 0 ? <p className={styles.helper}>{panelCopy.criteriaEmpty}</p> : null}
      {items.length > 0 ? (
        <ul aria-label={panelCopy.criteriaList} className={styles.checklistList}>
          {items.map((item, index) => (
            <CriterionRow
              key={item.id}
              item={item}
              index={index}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              readOnly={readOnly}
              onToggle={(next) =>
                toggle.mutate({ criterionId: item.id, done: next }, { onError: notifyError })
              }
              onRename={(text) =>
                rename.mutate({ criterionId: item.id, text }, { onError: notifyError })
              }
              onRemove={() => remove.mutate(item.id, { onError: notifyError })}
              onMove={(position) =>
                move.mutate({ criterionId: item.id, position }, { onError: notifyError })
              }
            />
          ))}
        </ul>
      ) : null}

      {busy ? (
        <p role="status" className={styles.helper}>
          {panelCopy.criteriaSaving}
        </p>
      ) : null}

      {readOnly ? <p className={styles.helper}>{panelCopy.criteriaReadOnly}</p> : null}
      {!readOnly && windingDown ? (
        <p className={styles.helper}>{panelCopy.criteriaWindingDown}</p>
      ) : null}
      {!readOnly && !windingDown && limitReached ? (
        <p className={styles.helper}>{panelCopy.criteriaLimit}</p>
      ) : null}
      {creating ? (
        <form noValidate onSubmit={submitAdd}>
          <TextField
            id={addFieldId}
            label={panelCopy.criteriaAddLabel}
            value={draft}
            aria-invalid={addError !== null}
            aria-describedby={addError ? `${addFieldId}-error` : undefined}
            onChange={(event) => {
              setDraft(event.currentTarget.value)
              if (addError) setAddError(validateCriterionText(event.currentTarget.value))
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

interface CriterionRowProps {
  readonly item: AcceptanceCriterionDto
  readonly index: number
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly readOnly: boolean
  readonly onToggle: (done: boolean) => void
  readonly onRename: (text: string) => void
  readonly onRemove: () => void
  readonly onMove: (position: number) => void
}

function CriterionRow({
  item,
  index,
  isFirst,
  isLast,
  readOnly,
  onToggle,
  onRename,
  onRemove,
  onMove,
}: CriterionRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.text)
  const [error, setError] = useState<string | null>(null)
  // Enter e Esc já encerram a edição; o blur que o desmonte dispara é ignorado.
  const settledRef = useRef(false)
  const errorId = useId()

  const finish = () => {
    settledRef.current = true
    setEditing(false)
    setError(null)
  }

  const commit = (showError: boolean) => {
    if (settledRef.current) return
    const message = validateCriterionText(draft)
    if (message) {
      if (showError) {
        setError(message)
        return
      }
      finish()
      return
    }
    const text = draft.trim()
    if (text === item.text) {
      finish()
      return
    }
    settledRef.current = true
    setEditing(false)
    onRename(text)
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
        <span className={styles.srOnly}>{panelCopy.criteriaToggle(item.text)}</span>
      </label>

      {editing ? (
        <form
          className={styles.checklistEdit}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            commit(true)
          }}
        >
          <input
            aria-label={panelCopy.criteriaRenameField}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            autoFocus
            className={styles.checklistInput}
            value={draft}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft(event.currentTarget.value)
              if (error) setError(validateCriterionText(event.currentTarget.value))
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
          aria-label={panelCopy.criteriaRename(item.text)}
          className={item.done ? styles.checklistTitleDone : styles.checklistTitle}
          disabled={readOnly}
          onClick={() => {
            settledRef.current = false
            setDraft(item.text)
            setError(null)
            setEditing(true)
          }}
        >
          {item.text}
        </button>
      )}

      {readOnly ? null : (
        <span className={styles.checklistActions}>
          <IconButton
            type="button"
            aria-label={panelCopy.criteriaMoveUp(item.text)}
            title="Mover para cima"
            disabled={isFirst}
            onClick={() => onMove(index - 1)}
          >
            <span aria-hidden="true">↑</span>
          </IconButton>
          <IconButton
            type="button"
            aria-label={panelCopy.criteriaMoveDown(item.text)}
            title="Mover para baixo"
            disabled={isLast}
            onClick={() => onMove(index + 1)}
          >
            <span aria-hidden="true">↓</span>
          </IconButton>
          <IconButton
            type="button"
            aria-label={panelCopy.criteriaRemove(item.text)}
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
