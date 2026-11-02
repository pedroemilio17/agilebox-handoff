import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useFocusTrap } from '../hooks/use-focus-trap'
import { useRestoreFocus } from '../hooks/use-restore-focus'
import { Kbd } from './Indicators'
import styles from './CommandPalette.module.css'

export interface CommandAction {
  readonly id: string
  readonly label: string
  readonly section: string
  readonly shortcut?: string
  readonly onSelect: (shift: boolean) => void
}
export interface CommandPaletteProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onClose: () => void
  readonly onComplete?: () => boolean
  readonly searchFeedback?: ReactNode
  readonly tokens: ReactNode
  readonly actions: readonly CommandAction[]
  readonly pending?: boolean
  readonly error?: string | null
}
export function CommandPalette({
  value,
  onChange,
  onClose,
  onComplete,
  tokens,
  searchFeedback,
  actions,
  pending = false,
  error,
}: CommandPaletteProps) {
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const [active, setActive] = useState(0)
  useFocusTrap(root)
  useRestoreFocus()
  useEffect(() => {
    input.current?.focus()
  }, [])
  useEffect(() => {
    setActive(0)
  }, [value])
  const index = Math.min(active, Math.max(0, actions.length - 1))
  useEffect(() => {
    root.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [index])
  const sections = [...new Set(actions.map((action) => action.section))]
  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose()
      }}
    >
      <div
        ref={root}
        tabIndex={-1}
        aria-busy={pending}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar ou criar"
        className={styles.palette}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            if (!pending) onClose()
          }
        }}
      >
        <div className={styles.searchRow}>
          <input
            ref={input}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            disabled={pending}
            placeholder="Buscar ou criar tarefa…"
            aria-label="Buscar ou criar tarefa"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls={`${id}-results`}
            aria-activedescendant={actions[index] ? `${id}-${actions[index].id}` : undefined}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                if (actions.length)
                  setActive(
                    (index + (event.key === 'ArrowDown' ? 1 : actions.length - 1)) % actions.length,
                  )
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                if (!pending) actions[index]?.onSelect(event.shiftKey)
              }
              if (event.key === 'Tab' && !event.shiftKey && onComplete?.()) event.preventDefault()
            }}
          />
          <button type="button" aria-label="Fechar busca" disabled={pending} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.tokens}>{tokens}</div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {pending && (
          <p role="status" className={styles.pending}>
            Criando tarefa…
          </p>
        )}
        {searchFeedback && <div className={styles.searchFeedback}>{searchFeedback}</div>}
        <div
          id={`${id}-results`}
          role="listbox"
          aria-label="Ações e tarefas"
          className={styles.results}
        >
          {sections.map((section) => (
            <div role="group" aria-label={section} key={section}>
              <p className={styles.section}>{section}</p>
              {actions
                .filter((action) => action.section === section)
                .map((action) => (
                  <div
                    key={action.id}
                    id={`${id}-${action.id}`}
                    role="option"
                    aria-selected={actions[index]?.id === action.id}
                    className={styles.option}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActive(actions.indexOf(action))}
                    onClick={() => {
                      if (!pending) action.onSelect(false)
                    }}
                  >
                    <span>{action.label}</span>
                    {action.shortcut && <Kbd>{action.shortcut}</Kbd>}
                  </div>
                ))}
            </div>
          ))}
        </div>
        <footer className={styles.footer}>
          <span>
            <Kbd>↑↓</Kbd> navegar · <Kbd>Tab</Kbd> completar
          </span>
          <span>@ pessoa · # projeto · data em português</span>
        </footer>
      </div>
    </div>
  )
}
