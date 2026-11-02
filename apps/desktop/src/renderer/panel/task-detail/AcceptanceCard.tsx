import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AcceptanceCriterionDto } from '@agilebox/contract'
import { ApiError } from '@agilebox/contract'
import { taskDetailCopy } from './copy'
import { useAcceptanceList, useAcceptanceSave, type AcceptanceAction } from './use-acceptance'
import styles from './Acceptance.module.css'

/** Texto do critério: não vazio, até 200 caracteres (o servidor confere de novo). */
const TEXT_MAX_LENGTH = 200

function textProblem(text: string): string | null {
  if (text === '') return taskDetailCopy.acceptanceEmptyText
  if (Array.from(text).length > TEXT_MAX_LENGTH) return taskDetailCopy.acceptanceTooLong
  return null
}

function saveProblem(error: unknown): string {
  return error instanceof ApiError && error.code === 'FORBIDDEN'
    ? taskDetailCopy.acceptanceForbidden
    : taskDetailCopy.acceptanceSaveError
}

export interface AcceptanceCardProps {
  readonly taskId: string
  /** Sem permissão de edição: só o texto, a marca e a contagem, sem campos nem botões. */
  readonly readOnly: boolean
}

interface CriterionRowProps {
  readonly criterion: AcceptanceCriterionDto
  readonly position: number
  readonly total: number
  readonly readOnly: boolean
  readonly textRef: (element: HTMLInputElement | null) => void
  readonly moveRef: (direction: 'up' | 'down', element: HTMLButtonElement | null) => void
  readonly onToggle: (done: boolean) => void
  readonly onEdit: (text: string) => void
  readonly onProblem: (message: string) => void
  readonly onMove: (direction: -1 | 1) => void
  readonly onRemove: () => void
}

function CriterionRow({
  criterion,
  position,
  total,
  readOnly,
  textRef,
  moveRef,
  onToggle,
  onEdit,
  onProblem,
  onMove,
  onRemove,
}: CriterionRowProps) {
  const [draft, setDraft] = useState(criterion.text)
  // O texto gravado volta ao campo quando o servidor responde com outro valor.
  useEffect(() => setDraft(criterion.text), [criterion.text])

  function commit() {
    const text = draft.trim()
    if (text === criterion.text) {
      setDraft(criterion.text)
      return
    }
    const problem = textProblem(text)
    if (problem) {
      onProblem(problem)
      setDraft(criterion.text)
      return
    }
    onEdit(text)
  }

  return (
    <li className={styles.row}>
      <span className={styles.check}>
        <input
          type="checkbox"
          aria-label={taskDetailCopy.criterionDone(position)}
          checked={criterion.done}
          disabled={readOnly}
          onChange={(event) => onToggle(event.currentTarget.checked)}
        />
      </span>
      {readOnly ? (
        <span className={criterion.done ? styles.textDone : styles.text}>{criterion.text}</span>
      ) : (
        <input
          ref={textRef}
          type="text"
          aria-label={taskDetailCopy.criterionText(position)}
          className={styles.textInput}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            } else if (event.key === 'Escape' && draft !== criterion.text) {
              // Com texto diferente do gravado, Esc só desfaz a edição (não fecha o detalhe).
              event.preventDefault()
              event.stopPropagation()
              setDraft(criterion.text)
            }
          }}
        />
      )}
      {readOnly ? null : (
        <span className={styles.actions}>
          <button
            type="button"
            ref={(element) => moveRef('up', element)}
            aria-label={taskDetailCopy.criterionUp(position)}
            className={styles.iconButton}
            disabled={position === 1}
            onClick={() => onMove(-1)}
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            ref={(element) => moveRef('down', element)}
            aria-label={taskDetailCopy.criterionDown(position)}
            className={styles.iconButton}
            disabled={position === total}
            onClick={() => onMove(1)}
          >
            <span aria-hidden="true">↓</span>
          </button>
          <button
            type="button"
            aria-label={taskDetailCopy.criterionRemove(position)}
            className={styles.iconButton}
            onClick={onRemove}
          >
            <span aria-hidden="true">×</span>
          </button>
        </span>
      )}
    </li>
  )
}

/**
 * Checklist de critérios de aceite (M3.13). Quem edita a tarefa adiciona, edita, marca, remove e
 * reordena. O foco fica coerente: ao adicionar volta ao campo de novo critério; ao remover, ao
 * critério vizinho; ao mover, ao próprio botão.
 */
export function AcceptanceCard({ taskId, readOnly }: AcceptanceCardProps) {
  const list = useAcceptanceList(taskId)
  const save = useAcceptanceSave(taskId)
  const [newText, setNewText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const addInput = useRef<HTMLInputElement>(null)
  const textInputs = useRef(new Map<string, HTMLInputElement>())
  const moveButtons = useRef(new Map<string, HTMLButtonElement>())

  if (list.isError) {
    return (
      <section aria-label={taskDetailCopy.acceptanceTitle}>
        <p role="alert">{taskDetailCopy.acceptanceLoadError}</p>
      </section>
    )
  }
  if (!list.data) {
    return (
      <section aria-label={taskDetailCopy.acceptanceTitle}>
        <p role="status">{taskDetailCopy.acceptanceLoading}</p>
      </section>
    )
  }

  const { criteria, summary } = list.data

  function run(action: AcceptanceAction, onDone?: () => void) {
    setProblem(null)
    save.mutate(action, {
      onSuccess: () => onDone?.(),
      onError: (error) => setProblem(saveProblem(error)),
    })
  }

  function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = newText.trim()
    const issue = textProblem(text)
    if (issue) {
      setProblem(issue)
      return
    }
    run({ kind: 'add', text }, () => {
      setNewText('')
      addInput.current?.focus()
    })
  }

  function removeAt(index: number) {
    const target = criteria[index + 1] ?? criteria[index - 1]
    run({ kind: 'remove', criterionId: criteria[index]!.id }, () => {
      if (target) textInputs.current.get(target.id)?.focus()
      else addInput.current?.focus()
    })
  }

  function moveAt(index: number, direction: -1 | 1) {
    const criterion = criteria[index]!
    const toIndex = index + direction
    run({ kind: 'reorder', criterionId: criterion.id, toIndex }, () => {
      const canGo = (dir: 'up' | 'down') =>
        dir === 'up' ? toIndex > 0 : toIndex < criteria.length - 1
      const dir = direction === -1 ? 'up' : 'down'
      const other = dir === 'up' ? 'down' : 'up'
      const next = canGo(dir) ? dir : canGo(other) ? other : null
      const element = next
        ? moveButtons.current.get(`${criterion.id}:${next}`)
        : textInputs.current.get(criterion.id)
      element?.focus()
    })
  }

  return (
    <section aria-label={taskDetailCopy.acceptanceTitle} className={styles.card}>
      <header className={styles.head}>
        <h3 className={styles.title}>{taskDetailCopy.acceptanceTitle}</h3>
        <span className={styles.count}>
          {summary.done}/{summary.total}
        </span>
      </header>
      {problem ? (
        <p role="alert" className={styles.error}>
          {problem}
        </p>
      ) : null}
      {criteria.length === 0 ? (
        <p className={styles.helper}>{taskDetailCopy.acceptanceEmpty}</p>
      ) : (
        <ol className={styles.list}>
          {criteria.map((criterion, index) => (
            <CriterionRow
              key={criterion.id}
              criterion={criterion}
              position={index + 1}
              total={criteria.length}
              readOnly={readOnly}
              textRef={(element) => {
                if (element) textInputs.current.set(criterion.id, element)
                else textInputs.current.delete(criterion.id)
              }}
              moveRef={(direction, element) => {
                const key = `${criterion.id}:${direction}`
                if (element) moveButtons.current.set(key, element)
                else moveButtons.current.delete(key)
              }}
              onToggle={(done) => run({ kind: 'setDone', criterionId: criterion.id, done })}
              onEdit={(text) => run({ kind: 'edit', criterionId: criterion.id, text })}
              onProblem={setProblem}
              onMove={(direction) => moveAt(index, direction)}
              onRemove={() => removeAt(index)}
            />
          ))}
        </ol>
      )}
      {readOnly ? null : (
        <form className={styles.form} onSubmit={submitNew}>
          <input
            ref={addInput}
            type="text"
            aria-label={taskDetailCopy.acceptanceNew}
            className={styles.textInput}
            value={newText}
            onChange={(event) => setNewText(event.currentTarget.value)}
          />
          <button type="submit" className={styles.addButton}>
            {taskDetailCopy.acceptanceAdd}
          </button>
        </form>
      )}
    </section>
  )
}
