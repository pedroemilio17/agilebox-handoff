import { useEffect, useRef, type ReactNode } from 'react'
import { useRestoreFocus } from '../hooks/use-restore-focus'
import styles from './Drawer.module.css'

export interface DrawerProps {
  readonly open: boolean
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
}

export function Drawer({ open, title, onClose, children }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null)
  useRestoreFocus(open)
  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])
  if (!open) return null
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      className={styles.drawer}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      {children}
    </div>
  )
}
