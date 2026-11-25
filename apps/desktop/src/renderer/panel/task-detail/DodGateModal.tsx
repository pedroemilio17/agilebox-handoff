import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DefinitionOfDoneItemDto } from '@agilebox/contract'
import { definitionCopy } from '../../shared/definition-of-done/copy'
import { taskCopy } from './task-detail-copy'
import styles from './TaskDetailView.module.css'

export interface DodGateModalProps {
  /** Itens atuais do projeto (a tarefa recarregada traz a lista nova). */
  readonly items: readonly DefinitionOfDoneItemDto[]
  /** O servidor recusou a conferência anterior: a lista mudou. */
  readonly reopened: boolean
  readonly saving: boolean
  readonly onCancel: () => void
  /** Conclui confirmando exatamente estes itens. */
  readonly onConfirm: (confirmedIds: readonly string[]) => void
}

/**
 * Conferência antes de concluir (#dod-gate-modal do protótipo). O servidor só conclui com todos os
 * itens confirmados, então "Concluir mesmo assim" só libera depois de marcar todos.
 */
export function DodGateModal({ items, reopened, saving, onCancel, onConfirm }: DodGateModalProps) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set())
  const cancelRef = useRef<HTMLButtonElement>(null)
  const allChecked = items.length > 0 && items.every((item) => checked.has(item.id))
  const allIds = items.map((item) => item.id)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  return createPortal(
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-dod-gate-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 id="task-dod-gate-title">{taskCopy.dodGateTitle}</h3>
          <button
            type="button"
            className={styles.modalClose}
            aria-label={taskCopy.dodGateClose}
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          <p>
            {taskCopy.dodGateIntro} <strong>{taskCopy.dodGateIntroStrong}</strong>{' '}
            {taskCopy.dodGateIntroTail}
          </p>
          {reopened ? <p role="status">{definitionCopy.reopened}</p> : null}
          <ul className={styles.checklistStack} aria-label={taskCopy.dodGateItems}>
            {items.map((item) => (
              <li key={item.id}>
                <label className={styles.checkboxRow} style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked.has(item.id)}
                    disabled={saving}
                    style={{ width: 17, height: 17, accentColor: '#d8d5df' }}
                    onChange={(event) => {
                      const on = event.currentTarget.checked
                      setChecked((current) => {
                        const next = new Set(current)
                        if (on) next.add(item.id)
                        else next.delete(item.id)
                        return next
                      })
                    }}
                  />
                  <span className={checked.has(item.id) ? styles.checklistTitleDone : undefined}>
                    {item.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.modalFooter}>
          <button
            ref={cancelRef}
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onCancel}
          >
            {taskCopy.dodGateCancel}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={!allChecked || saving}
            title={allChecked ? undefined : taskCopy.dodGateForceTitle}
            onClick={() => onConfirm(allIds)}
          >
            {taskCopy.dodGateForce}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={saving || items.length === 0}
            onClick={() => onConfirm(allIds)}
          >
            {taskCopy.dodGateCheckAll}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
