import { Fragment, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useRestoreFocus } from '../hooks/use-restore-focus'
import styles from './GlassMenu.module.css'
import { Kbd } from './Indicators'

export interface GlassMenuItem {
  readonly id: string
  readonly label: string
  readonly icon?: ReactNode
  /** Atalho exibido à direita, por exemplo "F2" ou "E". Só informativo. */
  readonly shortcut?: string
  readonly disabled?: boolean
  /** Separador visual antes deste item. */
  readonly separatorBefore?: boolean
}

export interface GlassMenuProps {
  /** Nome acessível do menu, por exemplo "Mais ações". */
  readonly label: string
  readonly items: readonly GlassMenuItem[]
  /** Chamado com o id do item escolhido. Depois dele, o menu chama `onClose`. */
  readonly onSelect: (id: string) => void
  /** Chamado ao escolher um item, com Esc ou com Tab. Quem monta o menu o desmonta aqui. */
  readonly onClose: () => void
  readonly className?: string
}

function enabledItems(container: HTMLElement | null): HTMLButtonElement[] {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
  )
}

/**
 * Menu flutuante em vidro (`role="menu"`). Navegação por setas, Home e End.
 * Esc e Tab fecham. Ao sair, o foco volta ao controle que abriu o menu.
 */
export function GlassMenu({ label, items, onSelect, onClose, className }: GlassMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Deve vir antes do foco inicial: o hook guarda o elemento focado no momento da montagem.
  useRestoreFocus()

  useEffect(() => {
    enabledItems(menuRef.current)[0]?.focus()
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      onClose()
      return
    }

    const options = enabledItems(menuRef.current)
    if (options.length === 0) return

    const current = options.indexOf(document.activeElement as HTMLButtonElement)
    let next: number
    switch (event.key) {
      case 'ArrowDown':
        next = current < 0 ? 0 : (current + 1) % options.length
        break
      case 'ArrowUp':
        next = current <= 0 ? options.length - 1 : current - 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = options.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    options[next]?.focus()
  }

  const classes = [styles.menu, className].filter(Boolean).join(' ')

  return (
    <div
      ref={menuRef}
      className={`${classes} motion-status-menu-enter`}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => (
        <Fragment key={item.id}>
          {item.separatorBefore ? <div role="separator" className={styles.separator} /> : null}
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={item.disabled}
            onClick={() => {
              onSelect(item.id)
              onClose()
            }}
          >
            {item.icon ? (
              <span className={styles.icon} aria-hidden="true">
                {item.icon}
              </span>
            ) : null}
            <span className={styles.label}>{item.label}</span>
            {item.shortcut ? <Kbd aria-hidden="true">{item.shortcut}</Kbd> : null}
          </button>
        </Fragment>
      ))}
    </div>
  )
}
