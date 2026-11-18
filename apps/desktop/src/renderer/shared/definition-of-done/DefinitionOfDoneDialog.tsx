import { useState } from 'react'
import { Button, ChecklistConfirm, Modal } from '@agilebox/ui'
import { definitionCopy } from './copy'
import styles from './DefinitionOfDoneDialog.module.css'

export interface DefinitionOfDoneDialogItem {
  readonly id: string
  readonly title: string
}

export interface DefinitionOfDoneDialogProps {
  /** Itens atuais do projeto; null quando não foi possível carregá-los. */
  readonly items: readonly DefinitionOfDoneDialogItem[] | null
  /** A conclusão anterior foi recusada: a lista mudou e precisa ser conferida de novo. */
  readonly reopened: boolean
  readonly saving: boolean
  /** "AB-140 · Aviso de chamado aberto": cabeçalho do diálogo. Sem ele, o título genérico. */
  readonly taskLabel?: string
  /** Estado para onde a tarefa volta ao cancelar ("Revisar"). */
  readonly returnTo?: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/** Conferência antes de concluir: só habilita Concluir com todos os itens marcados. Esc cancela. */
export function DefinitionOfDoneDialog({
  items,
  reopened,
  saving,
  taskLabel,
  returnTo,
  onConfirm,
  onCancel,
}: DefinitionOfDoneDialogProps) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set())
  const allChecked =
    items !== null && items.length > 0 && items.every((item) => checked.has(item.id))
  const remaining = items === null ? 0 : items.filter((item) => !checked.has(item.id)).length
  const title = taskLabel ?? definitionCopy.dialogTitle

  return (
    <Modal open title={title} onClose={onCancel} surface="glass">
      <div className={styles.content}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>{definitionCopy.eyebrow}</span>
          <h2>{title}</h2>
        </header>
        {items === null ? (
          <p role="alert">{definitionCopy.loadError}</p>
        ) : (
          <>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>
                <span className={styles.legendText}>{definitionCopy.criterionLegend}</span>
                <span className={styles.counter}>
                  {items.length - remaining}/{items.length}
                </span>
              </legend>
              <ChecklistConfirm
                label={definitionCopy.checklistLabel}
                items={items}
                checkedIds={checked}
                disabled={saving}
                onToggle={(id, on) =>
                  setChecked((current) => {
                    const next = new Set(current)
                    if (on) next.add(id)
                    else next.delete(id)
                    return next
                  })
                }
              />
            </fieldset>
            {reopened ? <p role="status">{definitionCopy.reopened}</p> : null}
            {remaining > 0 ? (
              <p className={styles.missing}>{definitionCopy.missing(remaining)}</p>
            ) : null}
          </>
        )}
        <footer className={styles.actions}>
          <Button type="button" onClick={onCancel}>
            {returnTo ? definitionCopy.returnTo(returnTo) : definitionCopy.cancel}
          </Button>
          {items !== null ? (
            <Button
              type="button"
              variant="primary"
              disabled={!allChecked || saving}
              onClick={onConfirm}
            >
              {definitionCopy.confirm}
            </Button>
          ) : null}
        </footer>
      </div>
    </Modal>
  )
}
