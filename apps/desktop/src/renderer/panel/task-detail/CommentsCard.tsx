import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { format } from 'date-fns'
import { ApiError } from '@agilebox/contract'
import type { GetTaskDto, TaskCommentDto } from '@agilebox/contract'
import { Avatar, Button, Kbd, MentionText, TextArea, Toast } from '@agilebox/ui'
import { formatRelativeDate } from '../../shared/lib/format-date'
import { panelCopy } from '../copy'
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
    const field = document.getElementById(fieldId) as HTMLTextAreaElement | null
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

  const onDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
    <section aria-labelledby={headingId} className={styles.card}>
      <header className={styles.checklistHeader}>
        <h3 id={headingId} className={styles.cardTitle}>
          {panelCopy.commentsCard}
        </h3>
        <span className={styles.checklistCount}>{task.comments.length}</span>
      </header>

      {task.comments.length === 0 ? (
        <p className={styles.helper}>{panelCopy.commentsEmpty}</p>
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
        <p role="status" className={styles.helper}>
          {panelCopy.commentSending}
        </p>
      ) : null}

      {readOnly ? <p className={styles.helper}>{panelCopy.commentReadOnly}</p> : null}

      {readOnly ? null : (
        <form
          noValidate
          className={styles.commentForm}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            submit()
          }}
        >
          <TextArea
            id={fieldId}
            label={panelCopy.commentWrite}
            rows={3}
            value={draft}
            aria-autocomplete="list"
            aria-controls={open ? listboxId : undefined}
            aria-activedescendant={open ? `${listboxId}-${current}` : undefined}
            aria-invalid={overLimit}
            aria-describedby={`${fieldId}-count${overLimit ? ` ${fieldId}-error` : ''}`}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              setDraft(event.currentTarget.value)
              setCaret(event.currentTarget.selectionStart)
              setDismissedAt(null)
              setActiveIndex(0)
            }}
            onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
            onKeyDown={onDraftKeyDown}
          />
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
          <div className={styles.blockFooter}>
            <span
              id={`${fieldId}-count`}
              className={overLimit ? styles.blockCountOver : styles.blockCount}
            >
              {panelCopy.commentLength(count, COMMENT_MAX_LENGTH)}
            </span>
            <span className={styles.helper} aria-hidden="true">
              {panelCopy.commentMentionHint}
            </span>
          </div>
          {overLimit ? (
            <p id={`${fieldId}-error`} role="alert" className={styles.blockError}>
              {panelCopy.commentBodyTooLong}
            </p>
          ) : null}
          <div className={styles.blockButtons}>
            <Button type="submit" variant="primary" disabled={submitDisabled}>
              {panelCopy.commentSubmit}
            </Button>
            <Kbd aria-hidden="true">Ctrl Enter</Kbd>
          </div>
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
    <li className={styles.comment}>
      <Avatar name={comment.authorName} />
      <div className={styles.commentMain}>
        <header className={styles.commentHeader}>
          <span className={styles.commentAuthor}>{comment.authorName}</span>
          {comment.asManager ? (
            <span className={styles.managerMark}>{panelCopy.commentManagerMark}</span>
          ) : null}
          <time
            className={styles.helper}
            dateTime={comment.createdAt}
            title={format(created, 'dd/MM/yyyy HH:mm')}
          >
            {formatRelativeDate(created, new Date())}
          </time>
          {comment.editedAt ? (
            <span
              className={styles.helper}
              title={format(new Date(comment.editedAt), 'dd/MM/yyyy HH:mm')}
            >
              {panelCopy.commentEdited}
            </span>
          ) : null}
        </header>

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
            <TextArea
              id={fieldId}
              label={panelCopy.commentEditField}
              rows={3}
              value={draft}
              aria-invalid={error !== null || overLimit}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setDraft(event.currentTarget.value)
                if (error) setError(validateCommentBody(event.currentTarget.value))
              }}
            />
            <div className={styles.blockFooter}>
              <span className={overLimit ? styles.blockCountOver : styles.blockCount}>
                {panelCopy.commentLength(count, COMMENT_MAX_LENGTH)}
              </span>
              {error ? (
                <p id={errorId} role="alert" className={styles.blockError}>
                  {error}
                </p>
              ) : null}
            </div>
            <div className={styles.blockButtons}>
              <Button type="submit" variant="primary" disabled={edit.isPending}>
                {panelCopy.commentSave}
              </Button>
              <Button type="button" onClick={cancelEdit}>
                {panelCopy.commentCancel}
              </Button>
            </div>
          </form>
        ) : (
          <p className={styles.commentBody}>
            <MentionText text={comment.body} mentions={comment.mentions} />
          </p>
        )}

        {mode === 'confirm' ? (
          <div
            role="group"
            aria-label={panelCopy.commentRemoveConfirm}
            className={styles.commentConfirm}
          >
            <span>{panelCopy.commentRemoveConfirm}</span>
            <Button
              type="button"
              variant="primary"
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
            </Button>
            <Button type="button" onClick={() => setMode('view')}>
              {panelCopy.commentCancel}
            </Button>
          </div>
        ) : null}

        {mode === 'view' && (canEdit || canRemove) ? (
          <div className={styles.commentActions}>
            {canEdit ? (
              <button
                type="button"
                className={styles.commentAction}
                aria-label={panelCopy.commentEdit(comment.authorName)}
                onClick={startEdit}
              >
                Editar
              </button>
            ) : null}
            {canRemove ? (
              <button
                type="button"
                className={styles.commentAction}
                aria-label={panelCopy.commentRemove(comment.authorName)}
                onClick={() => setMode('confirm')}
              >
                Remover
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}
