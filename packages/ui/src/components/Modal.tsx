import { useEffect, useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../hooks/use-focus-trap'
import styles from './Modal.module.css'

export interface ModalProps {
  readonly open: boolean
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
}

export function Modal({ open, title, onClose, children }: ModalProps) {
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
        className={`${styles.dialog} motion-modal-enter`}
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
