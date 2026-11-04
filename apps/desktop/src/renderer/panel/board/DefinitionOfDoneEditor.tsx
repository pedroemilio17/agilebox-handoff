import { useId, useRef, useState, type FormEvent } from 'react'
import type { DefinitionOfDoneItemDto } from '@agilebox/contract'
import { Button, ReadOnlyBadge, Toast } from '@agilebox/ui'
import {
  definitionLimitReached,
  definitionTitleError,
} from '../../shared/definition-of-done/definition-of-done'
import { panelCopy } from '../copy'
import {
  useChangeDefinitionOfDone,
  useDefinitionOfDone,
  type DefinitionChange,
} from '../hooks/use-definition-of-done'
import styles from './DefinitionOfDoneEditor.module.css'

export interface DefinitionOfDoneEditorProps {
  readonly projectId: string
  /** Gestor e criador do projeto editam; os outros veem a lista somente leitura. */
  readonly canEdit: boolean
}

/** Itens da definição de pronto do projeto, dentro do diálogo do projeto. */
export function DefinitionOfDoneEditor({ projectId, canEdit }: DefinitionOfDoneEditorProps) {
  const headingId = useId()
  const addErrorId = useId()
  const list = useDefinitionOfDone(projectId)
  const change = useChangeDefinitionOfDone(projectId)
  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const noticeSeq = useRef(0)
  const items: readonly DefinitionOfDoneItemDto[] = list.data ?? []
  const busy = change.isPending
  const limitReached = definitionLimitReached(items.length)

  const apply = (next: DefinitionChange, onDone?: () => void) =>
    change.mutate(next, {
      ...(onDone ? { onSuccess: onDone } : {}),
      onError: () => {
        noticeSeq.current += 1
        setNotice({ id: noticeSeq.current, message: panelCopy.definitionSaveError })
      },
    })

  const submitAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = definitionTitleError(draft)
    setAddError(message)
    if (message || busy || limitReached) return
    apply({ kind: 'add', title: draft.trim() }, () => setDraft(''))
  }

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <header className={styles.header}>
        <h3 id={headingId}>{panelCopy.definitionTitle}</h3>
        {canEdit ? null : <ReadOnlyBadge />}
      </header>
      <p className={styles.helper}>
        {canEdit ? panelCopy.definitionHelp : panelCopy.definitionReadOnly}
      </p>

      {list.isPending ? (
        <p role="status" className={styles.helper}>
          {panelCopy.definitionLoading}
        </p>
      ) : null}
      {list.isError ? <p role="alert">{panelCopy.definitionLoadError}</p> : null}

      {list.isSuccess && items.length === 0 ? (
        <p className={styles.helper}>{panelCopy.definitionEmpty}</p>
      ) : null}
      {items.length > 0 ? (
        <ol aria-label={panelCopy.definitionList} className={styles.list}>
          {items.map((item, index) => (
            <DefinitionRow
              key={item.id}
              item={item}
              index={index}
              isLast={index === items.length - 1}
              canEdit={canEdit}
              busy={busy}
              onRename={(title) => apply({ kind: 'rename', itemId: item.id, title })}
              onRemove={() => apply({ kind: 'remove', itemId: item.id })}
              onMove={(position) => apply({ kind: 'move', itemId: item.id, position })}
            />
          ))}
        </ol>
      ) : null}

      {canEdit && list.isSuccess ? (
        <form noValidate className={styles.addForm} onSubmit={submitAdd}>
          <input
            aria-label={panelCopy.definitionNewItem}
            aria-invalid={addError !== null}
            aria-describedby={addError ? addErrorId : undefined}
            autoComplete="off"
            className={styles.input}
            disabled={limitReached || busy}
            onChange={(event) => {
              setDraft(event.currentTarget.value)
              if (addError) setAddError(definitionTitleError(event.currentTarget.value))
            }}
            placeholder={panelCopy.definitionNewPlaceholder}
            value={draft}
          />
          <Button type="submit" disabled={limitReached || busy}>
            {panelCopy.definitionAdd}
          </Button>
          {addError ? (
            <p id={addErrorId} role="alert" className={styles.error}>
              {addError}
            </p>
          ) : null}
          {limitReached ? <p className={styles.helper}>{panelCopy.definitionLimit}</p> : null}
        </form>
      ) : null}

      {notice ? <Toast key={notice.id} message={notice.message} tone="warning" /> : null}
    </section>
  )
}

interface DefinitionRowProps {
  readonly item: DefinitionOfDoneItemDto
  readonly index: number
  readonly isLast: boolean
  readonly canEdit: boolean
  readonly busy: boolean
  readonly onRename: (title: string) => void
  readonly onRemove: () => void
  readonly onMove: (position: number) => void
}

function DefinitionRow({
  item,
  index,
  isLast,
  canEdit,
  busy,
  onRename,
  onRemove,
  onMove,
}: DefinitionRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.title)
  const [error, setError] = useState<string | null>(null)
  // Enter, Esc e o blur que desmonta o campo não podem salvar ou reverter duas vezes.
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
    const message = definitionTitleError(draft)
    if (message) {
      if (showError) setError(message)
      else finish()
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

  return (
    <li className={styles.row}>
      {editing ? (
        <form
          noValidate
          className={styles.editForm}
          onSubmit={(event) => {
            event.preventDefault()
            commit(true)
          }}
        >
          <input
            aria-label={panelCopy.definitionRenameField}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            autoFocus
            className={styles.input}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft(event.currentTarget.value)
              if (error) setError(definitionTitleError(event.currentTarget.value))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                // Esc cancela só a edição; não fecha o diálogo do projeto.
                event.stopPropagation()
                finish()
              }
            }}
            value={draft}
          />
          {error ? (
            <p id={errorId} role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <span className={styles.title}>{item.title}</span>
      )}

      {canEdit && !editing ? (
        <span className={styles.actions}>
          <button
            type="button"
            aria-label={panelCopy.definitionMoveUp(item.title)}
            className={styles.iconButton}
            disabled={busy || index === 0}
            onClick={() => onMove(index - 1)}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={panelCopy.definitionMoveDown(item.title)}
            className={styles.iconButton}
            disabled={busy || isLast}
            onClick={() => onMove(index + 1)}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={panelCopy.definitionRename(item.title)}
            className={styles.textButton}
            disabled={busy}
            onClick={startEdit}
          >
            Renomear
          </button>
          <button
            type="button"
            aria-label={panelCopy.definitionRemove(item.title)}
            className={styles.iconButton}
            disabled={busy}
            onClick={onRemove}
          >
            ×
          </button>
        </span>
      ) : null}
    </li>
  )
}
