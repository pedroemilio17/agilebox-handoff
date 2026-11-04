import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import styles from './ExportMenu.module.css'

export interface ExportMenuOption<Value extends string> {
  readonly value: Value
  readonly label: string
}

export interface ExportMenuProps<Value extends string> {
  /** Texto visível do botão. */
  readonly label: string
  /** Nome acessível do botão (aria-label). */
  readonly ariaLabel: string
  readonly options: readonly ExportMenuOption<Value>[]
  /** Enquanto true, o botão fica com aria-disabled (segue focável), não abre o menu e mostra `busyLabel`. */
  readonly busy?: boolean
  readonly busyLabel?: string
  readonly onSelect: (value: Value) => void
}

/** Botão com menu pequeno de opções (ex.: formato de exportação). Teclado: setas, Enter, Esc. */
export function ExportMenu<Value extends string>({
  label,
  ariaLabel,
  options,
  busy = false,
  busyLabel,
  onSelect,
}: ExportMenuProps<Value>) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  // Foco vai para a primeira opção ao abrir.
  useEffect(() => {
    if (open) wrapRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [open])

  // Clique fora fecha o menu sem roubar o foco.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  function close(restoreFocus: boolean) {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function moveFocus(step: 1 | -1) {
    const items = Array.from(
      wrapRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    )
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = (current + step + items.length) % items.length
    items[next]?.focus()
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Tab') {
      close(false)
    }
  }

  return (
    <span className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-disabled={busy || undefined}
        onClick={() => {
          if (!busy) setOpen((value) => !value)
        }}
      >
        {busy && busyLabel ? busyLabel : label}
      </button>
      {/* Anúncio do estado ocupado. O resultado (sucesso ou erro) é anunciado pelo toast do painel, sem repetir aqui. */}
      <span role="status" aria-live="polite" className={styles.srOnly}>
        {busy && busyLabel ? busyLabel : ''}
      </span>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          className={`${styles.menu} motion-status-menu-enter`}
          onKeyDown={handleMenuKeyDown}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                onSelect(option.value)
                close(true)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  )
}
