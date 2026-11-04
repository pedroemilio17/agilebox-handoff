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
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/** Conferência antes de concluir: só habilita Concluir com todos os itens marcados. Esc cancela. */
export function DefinitionOfDoneDialog({
  items,
  reopened,
  saving,
  onConfirm,
  onCancel,
}: DefinitionOfDoneDialogProps) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set())
  const allChecked =
    items !== null && items.length > 0 && items.every((item) => checked.has(item.id))

  return (
    <Modal open title={definitionCopy.dialogTitle} onClose={onCancel}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h2>{definitionCopy.dialogTitle}</h2>
        </header>
        {items === null ? (
          <p role="alert">{definitionCopy.loadError}</p>
        ) : (
          <>
            <p className={styles.intro}>{definitionCopy.dialogIntro}</p>
            {reopened ? <p role="status">{definitionCopy.reopened}</p> : null}
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
          </>
        )}
        <footer className={styles.actions}>
          <Button type="button" onClick={onCancel}>
            {definitionCopy.cancel}
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
