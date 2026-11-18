import { useEffect, useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../hooks/use-focus-trap'
import styles from './Modal.module.css'

export interface ModalProps {
  readonly open: boolean
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
  /** `glass`: vidro de conferência (440 px), como o diálogo "Antes de concluir". */
  readonly surface?: 'default' | 'glass'
  /** `wide`: duas colunas, como o encerramento de sprint. */
  readonly size?: 'default' | 'wide'
}

export function Modal({
  open,
  title,
  onClose,
  children,
  surface = 'default',
  size = 'default',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  useFocusTrap(dialogRef, open)

  useEffect(() => {
    if (!open) return
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current
      ?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      ?.focus()
    return () => {
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className={styles.backdrop}
      data-testid="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={[
          styles.dialog,
          surface === 'glass' ? styles.glass : null,
          size === 'wide' ? styles.sizeWide : null,
          'motion-modal-enter',
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
