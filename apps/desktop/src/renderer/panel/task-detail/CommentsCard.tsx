import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { format } from 'date-fns'
import { ApiError } from '@agilebox/contract'
import type { GetTaskDto, TaskCommentDto } from '@agilebox/contract'
import { MentionText, Toast } from '@agilebox/ui'
import { formatRelativeDate } from '../../shared/lib/format-date'
import { panelCopy } from '../copy'
import { taskCopy } from './task-detail-copy'
import { filterMentionOptions, findMentionQuery, insertMention } from './mention-suggest'
import type { MentionOption } from './mention-suggest'
import { useAddComment, useEditComment, useRemoveComment } from './use-task-detail'
import styles from './TaskDetailView.module.css'

/** Mesmo limite do contrato (`COMMENT_BODY_MAX_LENGTH`). */
export const COMMENT_MAX_LENGTH = 2000

/** Vazio ou acima de 2000 caracteres, contados sem os espaços das pontas (como o contrato). */
export function validateCommentBody(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return panelCopy.commentBodyRequired
  if (Array.from(trimmed).length > COMMENT_MAX_LENGTH) return panelCopy.commentBodyTooLong
  return null
}

/** Só participantes-usuários da tarefa podem ser mencionados; entidades ficam de fora. */
export function mentionOptionsOf(task: GetTaskDto): MentionOption[] {
  const byId = new Map<string, string>()
  for (const participation of task.participations) {
    if (participation.participant.kind === 'user')
      byId.set(participation.participant.userId, participation.participantName)
  }
  return [...byId].map(([id, name]) => ({ id, name }))
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.code === 'FORBIDDEN' ? panelCopy.forbidden : fallback
}

function countOf(value: string): number {
  return Array.from(value.trim()).length
}

export interface CommentsCardProps {
  readonly task: GetTaskDto
  readonly readOnlyScope?: boolean
}

export function CommentsCard({ task, readOnlyScope = false }: CommentsCardProps) {
  const taskId = task.id
  const readOnly = task.readOnly || readOnlyScope
  const add = useAddComment(taskId)
  const [draft, setDraft] = useState('')
  const [caret, setCaret] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const pendingCaret = useRef<number | null>(null)
  const headingId = useId()
  const fieldId = useId()
  const listboxId = useId()

  const mention = findMentionQuery(draft, caret)
  const suggestions =
    mention && mention.start !== dismissedAt
      ? filterMentionOptions(mentionOptionsOf(task), mention.query)
      : []
  const open = suggestions.length > 0
  const current = Math.min(activeIndex, Math.max(suggestions.length - 1, 0))

  // Depois de inserir uma menção, o cursor vai para o fim do nome inserido.
  useEffect(() => {
    if (pendingCaret.current === null) return
    const field = document.getElementById(fieldId) as HTMLInputElement | null
    field?.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  }, [draft, fieldId])

  const notify = (message: string) =>
    setNotice((previous) => ({ id: (previous?.id ?? 0) + 1, message }))

  const choose = (option: MentionOption) => {
    if (!mention) return
    const next = insertMention(draft, mention, caret, option.name)
    pendingCaret.current = next.caret
    setDraft(next.text)
    setCaret(next.caret)
    setActiveIndex(0)
    // A menção escolhida não reabre a lista; ela volta só quando o texto muda.
    setDismissedAt(mention.start)
  }

  const submit = () => {
    if (validateCommentBody(draft) !== null) return
    add.mutate(draft.trim(), {
      onSuccess: () => {
        setDraft('')
        setCaret(0)
        setActiveIndex(0)
        setDismissedAt(null)
        document.getElementById(fieldId)?.focus()
      },
      onError: (error) => notify(errorMessage(error, panelCopy.commentSaveError)),
    })
  }

  const onDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (open && mention) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % suggestions.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length)
        return
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        choose(suggestions[current]!)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setDismissedAt(mention.start)
        return
      }
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submit()
    }
  }

  const count = countOf(draft)
  const overLimit = count > COMMENT_MAX_LENGTH
  const submitDisabled = validateCommentBody(draft) !== null || add.isPending

  return (
    <section aria-labelledby={headingId} className={styles.topicSection}>
      <div className={styles.topicSectionHead}>
        <h2 id={headingId} className={styles.topicSectionTitle}>
          {panelCopy.commentsCard}
        </h2>
        <span className={styles.topicSectionMeta}>{task.comments.length}</span>
      </div>

      {task.comments.length === 0 ? (
        <p className={styles.emptyNote}>{panelCopy.commentsEmpty}</p>
      ) : (
        <ol aria-label={panelCopy.commentsList} className={styles.commentList}>
          {task.comments.map((comment) => (
            <CommentItem
              key={comment.id}
              taskId={taskId}
              comment={comment}
              canChange={!readOnly}
              onNotice={notify}
            />
          ))}
        </ol>
      )}

      {add.isPending ? (
        <p role="status" className={styles.kvHint}>
          {panelCopy.commentSending}
        </p>
      ) : null}

      {readOnly ? <p className={styles.kvHint}>{panelCopy.commentReadOnly}</p> : null}

      {readOnly ? null : (
        <form
          noValidate
          className={styles.commentFormWrap}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className={styles.inlineAddRow}>
            <input
              id={fieldId}
              type="text"
              className={styles.input}
              placeholder={taskCopy.commentPlaceholder}
              aria-label={panelCopy.commentWrite}
              value={draft}
              aria-autocomplete="list"
              aria-controls={open ? listboxId : undefined}
              aria-activedescendant={open ? `${listboxId}-${current}` : undefined}
              aria-invalid={overLimit}
              aria-describedby={overLimit ? `${fieldId}-error` : undefined}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setDraft(event.currentTarget.value)
                setCaret(event.currentTarget.selectionStart ?? 0)
                setDismissedAt(null)
                setActiveIndex(0)
              }}
              onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
              onKeyDown={onDraftKeyDown}
            />
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={submitDisabled}
            >
              {panelCopy.commentSubmit}
            </button>
          </div>
          {open ? (
            <ul
              id={listboxId}
              role="listbox"
              aria-label={panelCopy.commentSuggestions}
              className={styles.mentionList}
            >
              {suggestions.map((option, index) => (
                <li
                  key={option.id}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={index === current}
                  className={index === current ? styles.mentionOptionActive : styles.mentionOption}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  {option.name}
                </li>
              ))}
            </ul>
          ) : null}
          {overLimit ? (
            <p id={`${fieldId}-error`} role="alert" className={styles.errorNote}>
              {panelCopy.commentBodyTooLong}
            </p>
          ) : null}
        </form>
      )}

      {notice ? <Toast key={notice.id} message={notice.message} /> : null}
    </section>
  )
}

interface CommentItemProps {
  readonly taskId: string
  readonly comment: TaskCommentDto
  readonly canChange: boolean
  readonly onNotice: (message: string) => void
}

function CommentItem({ taskId, comment, canChange, onNotice }: CommentItemProps) {
  const edit = useEditComment(taskId)
  const remove = useRemoveComment(taskId)
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm'>('view')
  const [draft, setDraft] = useState(comment.body)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()
  const fieldId = useId()
  const created = new Date(comment.createdAt)
  const canEdit = canChange && comment.canEdit
  const canRemove = canChange && comment.canRemove

  const startEdit = () => {
    setDraft(comment.body)
    setError(null)
    setMode('edit')
  }

  const cancelEdit = () => {
    setDraft(comment.body)
    setError(null)
    setMode('view')
  }

  const saveEdit = () => {
    const message = validateCommentBody(draft)
    setError(message)
    if (message) return
    const body = draft.trim()
    if (body === comment.body) {
      setMode('view')
      return
    }
    edit.mutate(
      { commentId: comment.id, body },
      {
        onSuccess: () => setMode('view'),
        onError: (failure) => onNotice(errorMessage(failure, panelCopy.commentSaveError)),
      },
    )
  }

  const count = countOf(draft)
  const overLimit = count > COMMENT_MAX_LENGTH

  return (
    <li className={styles.commentRow}>
      <div className={styles.commentMeta}>
        <span className={styles.commentAuthor}>
          <strong>{comment.authorName}</strong>
          {comment.asManager ? (
            <span className={`${styles.badge} ${styles.badgeGestor}`}>
              {panelCopy.commentManagerMark}
            </span>
          ) : null}
        </span>
        <span className={styles.commentRight}>
          {comment.editedAt ? (
            <span title={format(new Date(comment.editedAt), 'dd/MM/yyyy HH:mm')}>
              {panelCopy.commentEdited}
            </span>
          ) : null}
          <time dateTime={comment.createdAt} title={format(created, 'dd/MM/yyyy HH:mm')}>
            {formatRelativeDate(created, new Date())}
          </time>
        </span>
      </div>

      {mode === 'edit' ? (
        <form
          noValidate
          className={styles.commentEditForm}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            saveEdit()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              cancelEdit()
            }
          }}
        >
          <textarea
            id={fieldId}
            className={styles.cleanTextarea}
            aria-label={panelCopy.commentEditField}
            rows={3}
            value={draft}
            aria-invalid={error !== null || overLimit}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setDraft(event.currentTarget.value)
              if (error) setError(validateCommentBody(event.currentTarget.value))
            }}
          />
          <div className={styles.formFooter}>
            <span className={styles.topicSectionMeta}>
              {panelCopy.commentLength(count, COMMENT_MAX_LENGTH)}
            </span>
            {error ? (
              <p id={errorId} role="alert" className={styles.errorNote}>
                {error}
              </p>
            ) : null}
          </div>
          <div className={styles.buttonRow}>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
              disabled={edit.isPending}
            >
              {panelCopy.commentSave}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
              onClick={cancelEdit}
            >
              {panelCopy.commentCancel}
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.commentText}>
          <MentionText text={comment.body} mentions={comment.mentions} />
        </p>
      )}

      {mode === 'confirm' ? (
        <div role="group" aria-label={panelCopy.commentRemoveConfirm} className={styles.buttonRow}>
          <span className={styles.kvHint}>{panelCopy.commentRemoveConfirm}</span>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(comment.id, {
                onError: (failure) => {
                  setMode('view')
                  onNotice(errorMessage(failure, panelCopy.commentRemoveError))
                },
              })
            }
          >
            {panelCopy.commentRemoveYes}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
            onClick={() => setMode('view')}
          >
            {panelCopy.commentCancel}
          </button>
        </div>
      ) : null}

      {mode === 'view' && (canEdit || canRemove) ? (
        <div className={styles.rowActions}>
          {canEdit ? (
            <button
              type="button"
              className={styles.rowAction}
              aria-label={panelCopy.commentEdit(comment.authorName)}
              onClick={startEdit}
            >
              Editar
            </button>
          ) : null}
          {canRemove ? (
            <button
              type="button"
              className={styles.rowAction}
              aria-label={panelCopy.commentRemove(comment.authorName)}
              onClick={() => setMode('confirm')}
            >
              Remover
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
