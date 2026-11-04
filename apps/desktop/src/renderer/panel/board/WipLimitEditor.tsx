import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Button, NumberField } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { parseWipLimitInput } from './wip-limit'
import styles from './WipLimitEditor.module.css'

export interface WipLimitEditorProps {
  readonly columnName: string
  readonly limit: number | null
  /** Salvar um número ou remover (null). Erros de servidor ficam com quem chama (toast). */
  readonly onSave: (limit: number | null) => void
}

/** Botão "Definir limite" do cabeçalho e o painel pequeno para editar o limite de uma coluna. */
export function WipLimitEditor({ columnName, limit, onSave }: WipLimitEditorProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputId = useId()
  const errorId = `${inputId}-error`
  const wasOpen = useRef(false)

  // Foco volta ao botão quando o painel fecha (Salvar, Remover, Cancelar ou Esc).
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  function openPanel() {
    setValue(limit === null ? '' : String(limit))
    setError(null)
    setOpen(true)
  }

  function save() {
    const parsed = parseWipLimitInput(value)
    if (parsed === null) {
      setError(panelCopy.wipLimitInvalid)
      return
    }
    onSave(parsed)
    setOpen(false)
  }

  function remove() {
    onSave(null)
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <span className={styles.wrap}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={panelCopy.wipLimitDefine(columnName)}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        Definir limite
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={panelCopy.wipLimitDialog(columnName)}
          className={styles.panel}
          onKeyDown={handleKeyDown}
        >
          <form
            className={styles.form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <NumberField
              id={inputId}
              label="Limite de tarefas"
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                if (error) setError(null)
              }}
              autoComplete="off"
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            {error ? (
              <p id={errorId} role="alert" className={styles.error}>
                {error}
              </p>
            ) : null}
            <div className={styles.actions}>
              <Button variant="primary" type="submit">
                Salvar
              </Button>
              <Button type="button" onClick={remove} disabled={limit === null}>
                Remover limite
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </span>
  )
}
